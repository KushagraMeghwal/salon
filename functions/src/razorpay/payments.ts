import { logger } from 'firebase-functions';
import { Timestamp } from 'firebase-admin/firestore';
import { CHECKOUT_HOLD_TTL_MS, RECEIPT_PREFIX } from '../config';
import { fail, MESSAGES, RazorpayApiError } from '../lib/errors';
import { priceServices, type PricedService } from '../lib/pricing';
import { staffDayId } from '../bookings/hold';
import { getValidAccessToken } from './tokens';
import { salonRef, type Deps } from './types';

export interface OrderResult {
  bookingId: string;
  orderId: string;
  /** Server-computed amount in paise (what Checkout must charge). */
  amount: number;
  currency: 'INR';
  /** Razorpay OAuth public token, used as Checkout `key`. Public by design. */
  keyId: string;
  reused: boolean;
}

export const receiptFor = (bookingId: string) => `${RECEIPT_PREFIX}${bookingId}`;

/**
 * Creates (or returns the existing) Razorpay order for a HELD booking, on the connected salon's own account.
 * The amount is recomputed here from the salon's service prices; nothing the client sends is used.
 */
export async function createPaymentOrder(d: Deps, input: { salonId: string; bookingId: string; uid: string }): Promise<OrderResult> {
  const now = d.now();
  const bookingRef = d.db.doc(`salons/${input.salonId}/bookings/${input.bookingId}`);
  const [bookingSnap, salonSnap] = await Promise.all([bookingRef.get(), salonRef(d, input.salonId).get()]);
  if (!bookingSnap.exists || !salonSnap.exists) fail('not-found', MESSAGES.notFound);

  const b = bookingSnap.data() as {
    customerId: string | null;
    status: string;
    holdExpiresAt?: Timestamp;
    createdAt?: Timestamp;
    services: { serviceId: string }[];
    payment?: { status?: string; orderId?: string; amount?: number; mode?: string };
  };
  // A customer can only pay for their own booking.
  if (b.customerId !== input.uid) fail('permission-denied', MESSAGES.forbidden, { reason: 'not-booking-owner', bookingId: input.bookingId });
  if (b.status !== 'held') fail('failed-precondition', b.status === 'expired' ? MESSAGES.holdExpired : MESSAGES.badInput, { reason: 'not-held', status: b.status });
  if (!b.holdExpiresAt || b.holdExpiresAt.toMillis() <= now.getTime()) fail('failed-precondition', MESSAGES.holdExpired, { reason: 'hold-expired' });

  if (salonSnap.get('paymentConnection.status') !== 'CONNECTED') fail('failed-precondition', MESSAGES.notConnected, { reason: 'salon-not-connected', salonId: input.salonId });

  // Recompute the price from the salon's current service catalogue.
  const serviceDocs = await Promise.all(b.services.map((s) => d.db.doc(`salons/${input.salonId}/services/${s.serviceId}`).get()));
  const priced: PricedService[] = serviceDocs.map((s, i) => {
    if (!s.exists || s.get('active') === false) fail('failed-precondition', MESSAGES.badInput, { reason: 'service-unavailable', serviceId: b.services[i].serviceId });
    return { serviceId: s.id, name: s.get('name'), price: s.get('price'), duration: s.get('duration') };
  });
  const { price, amountPaise } = priceServices(priced);
  if (amountPaise <= 0) fail('failed-precondition', MESSAGES.badInput, { reason: 'zero-amount' });

  const { accessToken, publicToken } = await getValidAccessToken(d, input.salonId);
  if (!publicToken) fail('failed-precondition', MESSAGES.notConnected, { reason: 'no-public-token', salonId: input.salonId });

  // Idempotent: a live order for the same amount is returned instead of creating a duplicate.
  if (b.payment?.orderId && b.payment.status === 'pending' && b.payment.amount === amountPaise) {
    return { bookingId: input.bookingId, orderId: b.payment.orderId, amount: amountPaise, currency: 'INR', keyId: publicToken, reused: true };
  }

  let order;
  try {
    order = await d.svc.createOrder({
      accessToken,
      amountPaise,
      receipt: receiptFor(input.bookingId),
      notes: { salonId: input.salonId, bookingId: input.bookingId },
    });
  } catch (e) {
    logger.warn('razorpay order creation failed', { salonId: input.salonId, bookingId: input.bookingId, kind: e instanceof Error ? e.message : 'unknown' });
    if (e instanceof RazorpayApiError && (e.kind === 'timeout' || e.kind === 'network' || (e.status ?? 0) >= 500)) fail('unavailable', MESSAGES.unavailable);
    fail('failed-precondition', MESSAGES.paymentFailed);
  }

  // Extend the hold for checkout, but never past 30 minutes after the booking was created (no indefinite slot hoarding).
  // The staffDays lock entry must be extended together with the booking, or another customer could take the slot mid-payment.
  const holdUntil = Timestamp.fromMillis(Math.min(now.getTime() + CHECKOUT_HOLD_TTL_MS, (b.createdAt?.toMillis() ?? now.getTime()) + 2 * CHECKOUT_HOLD_TTL_MS));
  await d.db.runTransaction(async tx => {
    const fresh = await tx.get(bookingRef);
    const dayRef = d.db.doc(`salons/${input.salonId}/staffDays/${staffDayId(fresh.get('staffId'), fresh.get('date'))}`);
    const day = await tx.get(dayRef);
    if (fresh.get('status') !== 'held') return; // confirmed/expired meanwhile: leave everything as is
    const busy = (day.data()?.['busy'] ?? []) as { bookingId: string; holdUntil?: Timestamp }[];
    if (day.exists) tx.set(dayRef, { busy: busy.map((x) => (x.bookingId === input.bookingId && x.holdUntil ? { ...x, holdUntil } : x)) });
    tx.update(bookingRef, {
      price,
      'payment.mode': 'online',
      'payment.status': 'pending',
      'payment.provider': 'razorpay',
      'payment.orderId': order.id,
      'payment.amount': amountPaise,
      'payment.currency': 'INR',
      'payment.createdAt': Timestamp.fromDate(now),
      'payment.failureReason': null,
      holdExpiresAt: holdUntil,
      updatedAt: Timestamp.fromDate(now),
    });
  });  logger.info('razorpay order created', { salonId: input.salonId, bookingId: input.bookingId });
  return { bookingId: input.bookingId, orderId: order.id, amount: amountPaise, currency: 'INR', keyId: publicToken, reused: false };
}
