import { logger } from 'firebase-functions';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { verifyWebhookSignature, sha256 } from '../lib/signature';
import { staffDayId } from '../bookings/hold';
import { COL, type BaseDeps } from './types';

export interface WebhookRequest {
  rawBody: Buffer;
  signature: string | undefined;
  /** X-Razorpay-Event-Id. TODO(razorpay): confirm this header is sent for partner/OAuth app webhooks. */
  eventIdHeader: string | undefined;
  secret: string;
}

export type WebhookOutcome = 'invalid-signature' | 'bad-payload' | 'duplicate' | 'ignored' | 'confirmed' | 'late-confirmed' | 'payment-failed' | 'refunded' | 'rejected' | 'error';
export interface WebhookResult {
  status: 200 | 400 | 500;
  outcome: WebhookOutcome;
}

interface PaymentEntity {
  id: string;
  order_id?: string;
  amount?: number;
  method?: string;
  notes?: Record<string, string> | unknown[];
  error_code?: string | null;
}
interface RazorpayEvent {
  event: string;
  account_id?: string;
  payload?: { payment?: { entity?: PaymentEntity }; refund?: { entity?: { id: string; payment_id: string; amount?: number } } };
}

type Busy = { bookingId: string; start: number; end: number; holdUntil?: Timestamp };

/** Verifies, de-duplicates and applies one Razorpay webhook. Only a verified webhook can confirm a booking. */
export async function processWebhook(d: BaseDeps, req: WebhookRequest): Promise<WebhookResult> {
  // 1. Signature over the RAW body. Anything unverified changes nothing.
  if (!verifyWebhookSignature(req.rawBody, req.signature, req.secret)) {
    logger.warn('webhook signature rejected');
    return { status: 400, outcome: 'invalid-signature' };
  }
  let ev: RazorpayEvent;
  try {
    ev = JSON.parse(req.rawBody.toString('utf8'));
    if (typeof ev.event !== 'string') throw new Error('no event');
  } catch {
    return { status: 400, outcome: 'bad-payload' };
  }

  // 2. Idempotency ledger. Create-if-absent in a transaction; an already-seen event is acknowledged and skipped.
  const eventId = req.eventIdHeader?.trim() || sha256(req.rawBody.toString('utf8'));
  const ledger = d.db.doc(`${COL.webhookEvents}/${eventId}`);
  const fresh = await d.db.runTransaction(async (tx) => {
    const s = await tx.get(ledger);
    if (s.exists) return false;
    tx.set(ledger, { event: ev.event, status: 'processing', receivedAt: Timestamp.fromDate(d.now()) });
    return true;
  });
  if (!fresh) return { status: 200, outcome: 'duplicate' };

  try {
    const outcome = await apply(d, ev);
    await ledger.update({ status: 'done', outcome, processedAt: Timestamp.fromDate(d.now()) });
    return { status: 200, outcome };
  } catch (e) {
    // Let Razorpay retry: drop the ledger entry so the redelivery is processed again.
    logger.error('webhook processing failed', { event: ev.event, kind: e instanceof Error ? e.message : 'unknown' });
    await ledger.delete().catch(() => undefined);
    return { status: 500, outcome: 'error' };
  }
}

async function findBooking(d: BaseDeps, ev: RazorpayEvent, pay: PaymentEntity | undefined, paymentId: string | undefined) {
  const notes = pay?.notes && !Array.isArray(pay.notes) ? pay.notes : undefined;
  if (notes?.['salonId'] && notes['bookingId']) return d.db.doc(`salons/${notes['salonId']}/bookings/${notes['bookingId']}`);
  if (paymentId) {
    const q = await d.db.collectionGroup('bookings').where('payment.paymentId', '==', paymentId).limit(1).get();
    if (!q.empty) return q.docs[0].ref;
  }
  return null;
}

async function apply(d: BaseDeps, ev: RazorpayEvent): Promise<WebhookOutcome> {
  const pay = ev.payload?.payment?.entity;
  const refund = ev.payload?.refund?.entity;
  const kind = ev.event === 'payment.captured' ? 'captured' : ev.event === 'payment.failed' ? 'failed' : ev.event === 'refund.processed' ? 'refunded' : null;
  if (!kind) return 'ignored';

  const paymentId = pay?.id ?? refund?.payment_id;
  if (!paymentId) return 'ignored';
  const ref = await findBooking(d, ev, pay, paymentId);
  if (!ref) return 'ignored';
  const salonId = ref.parent.parent!.id;

  const now = d.now();
  const stamp = Timestamp.fromDate(now);

  return d.db.runTransaction(async (tx: Transaction): Promise<WebhookOutcome> => {
    const [snap, salonSnap] = await Promise.all([tx.get(ref), tx.get(d.db.doc(`salons/${salonId}`))]);
    if (!snap.exists || !salonSnap.exists) return 'ignored';
    const b = snap.data()!;
    const p = (b['payment'] ?? {}) as { orderId?: string; amount?: number; status?: string; paymentId?: string };

    // 3. Never trust the payload's implied ownership: the event must come from THIS salon's connected account,
    //    and (for payment events) reference the order and amount we created for this booking.
    if (ev.account_id && ev.account_id !== salonSnap.get('paymentConnection.razorpayAccountId')) {
      logger.warn('webhook account mismatch', { salonId });
      return 'rejected';
    }
    if (kind !== 'refunded') {
      if (!pay?.order_id || pay.order_id !== p.orderId || (typeof pay.amount === 'number' && pay.amount !== p.amount)) {
        logger.warn('webhook order/amount mismatch', { salonId, bookingId: snap.id });
        return 'rejected';
      }
    } else if (p.paymentId !== paymentId) {
      return 'rejected';
    }

    if (kind === 'failed') {
      if (p.status === 'paid') return 'ignored'; // a later failure never undoes a captured payment
      tx.update(ref, { 'payment.status': 'failed', 'payment.failureReason': pay?.error_code ?? 'failed', updatedAt: stamp });
      return 'payment-failed';
    }

    if (kind === 'refunded') {
      // Booking history is not rewritten; only the payment state moves.
      tx.update(ref, { 'payment.status': 'refunded', 'payment.refundedAt': stamp, 'payment.refundAmount': refund?.amount ?? p.amount ?? null, updatedAt: stamp });
      return 'refunded';
    }

    // captured
    if (p.status === 'paid') return 'ignored';
    const dayRef = d.db.doc(`salons/${salonId}/staffDays/${staffDayId(b['staffId'], b['date'])}`);
    const day = await tx.get(dayRef);
    const busy = (day.data()?.['busy'] ?? []) as Busy[];
    const paid = {
      'payment.status': 'paid',
      'payment.paymentId': paymentId,
      'payment.method': pay?.method ?? null,
      'payment.capturedAt': stamp,
      updatedAt: stamp,
    };

    if (b['status'] === 'held') {
      // Make the hold permanent (drop holdUntil) and confirm.
      tx.set(dayRef, { busy: busy.map((x) => (x.bookingId === snap.id ? { bookingId: x.bookingId, start: x.start, end: x.end } : x)) });
      tx.update(ref, { ...paid, status: 'confirmed', confirmedAt: stamp, holdExpiresAt: null });
      return 'confirmed';
    }
    if (b['status'] === 'expired') {
      // Paid after the hold was released. Confirm only if nobody took the slot meanwhile.
      const clash = busy.some((x) => x.bookingId !== snap.id && b['start'] < x.end && b['end'] > x.start && (!x.holdUntil || x.holdUntil.toMillis() > now.getTime()));
      if (!clash) {
        tx.set(dayRef, { busy: [...busy.filter((x) => x.bookingId !== snap.id), { bookingId: snap.id, start: b['start'], end: b['end'] }] });
        tx.update(ref, { ...paid, status: 'confirmed', confirmedAt: stamp, holdExpiresAt: null });
        return 'late-confirmed';
      }
      // Slot is gone: keep the payment record and flag it so the owner/refund flow can act.
      tx.update(ref, { ...paid, 'payment.refundRequired': true });
      return 'ignored';
    }
    // Any other state (cancelled, completed...): just record the money.
    tx.update(ref, paid);
    return 'ignored';
  });
}
