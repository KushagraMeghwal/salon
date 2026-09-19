import { logger } from 'firebase-functions';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HOLD_TTL_MS } from '../config';
import { fail, MESSAGES } from '../lib/errors';
import { checkSalonRules, customerKey, effectiveTiming, istNow, overlaps, phoneKey, priceServices, weekdayIndex, type PricedService } from '../../../shared/src';
import { sha256 } from '../lib/signature';
import type { BaseDeps } from '../razorpay/types';

interface Busy {
  bookingId: string;
  start: number;
  end: number;
  /** Present while the slot is only held (awaiting payment). Removed when the booking is confirmed. */
  holdUntil?: Timestamp;
}

export interface HoldInput {
  uid: string;
  salonId: string;
  /** Client-generated id; the same (uid, requestId) always returns the same booking, so retries never double-book. */
  requestId: string;
  serviceIds: string[];
  staffId: string; // a staff id or 'any'
  date: string; // YYYY-MM-DD, salon local
  start: number; // minutes from midnight
  customerName: string;
  customerPhone: string;
  /** 'hold' (default): slot locked while the customer pays online. 'confirmed': booking is final straight away. */
  mode?: 'hold' | 'confirmed';
  source?: 'online' | 'owner';
  paymentMode?: 'online' | 'salon';
  /** Owner-made bookings are not tied to a customer login (null). Defaults to `uid`. */
  customerId?: string | null;
  notes?: string;
  /** Owner-only: custom duration for a one-off appointment. */
  durationOverride?: number;
}

export const staffDayId = (staffId: string, date: string) => `${staffId}_${date}`;
export const bookingIdFor = (uid: string, requestId: string) => sha256(`${uid}:${requestId}`).slice(0, 20);

/**
 * Holds a slot for online payment inside one Firestore transaction. The staffDays document is the lock: two
 * customers racing for the same slot both read it, and Firestore retries the loser against the winner's write.
 */
export async function createHeldBooking(d: BaseDeps, input: HoldInput) {
  return createBooking(d, { ...input, mode: 'hold' });
}

/** Creates a booking (held or confirmed) under the staffDays lock. See HoldInput for the modes. */
export async function createBooking(
  d: BaseDeps,
  input: HoldInput,
): Promise<{ bookingId: string; holdExpiresAt: Date; staffId: string; price: number; created: boolean; bookingNo: string; status: string }> {
  const now = d.now();
  const nowIst = istNow(now);
  const mode = input.mode ?? 'hold';
  const source = input.source ?? 'online';
  const paymentMode = input.paymentMode ?? 'online';
  const customerId = input.customerId === undefined ? input.uid : input.customerId;
  // Customers need 15 minutes of lead time; the owner may enter someone already at the desk (up to an hour into the slot).
  const earliest = source === 'owner' ? nowIst.minutes - 60 : nowIst.minutes + 15;
  if (input.date < nowIst.date || (input.date === nowIst.date && input.start < earliest)) fail('invalid-argument', MESSAGES.badInput, { reason: 'in-the-past' });

  const bookingId = bookingIdFor(input.uid, input.requestId);
  const bookingRef = d.db.doc(`salons/${input.salonId}/bookings/${bookingId}`);

  return d.db.runTransaction(async (tx: Transaction) => {
    const existing = await tx.get(bookingRef);
    if (existing.exists) {
      const e = existing.data() as { staffId: string; price: number; holdExpiresAt?: Timestamp; bookingNo: string; status: string };
      return { bookingId, holdExpiresAt: e.holdExpiresAt?.toDate() ?? now, staffId: e.staffId, price: e.price, created: false, bookingNo: e.bookingNo, status: e.status };
    }

    const salonSnap = await tx.get(d.db.doc(`salons/${input.salonId}`));
    if (!salonSnap.exists) fail('not-found', MESSAGES.notFound);
    const salon = salonSnap.data()!;
    if (source === 'owner') {
      if (salon['status'] === 'suspended') fail('failed-precondition', MESSAGES.notFound, { reason: 'salon-suspended' });
    } else {
      if (salon['status'] !== 'active' || salon['bookable'] !== true) fail('failed-precondition', MESSAGES.notFound, { reason: 'salon-not-bookable' });
      if (mode === 'hold' && salon['paymentConnection']?.status !== 'CONNECTED') fail('failed-precondition', MESSAGES.notConnected, { reason: 'salon-not-connected' });
    }
    const customerDocRef = phoneKey(input.customerPhone) ? d.db.doc(`salons/${input.salonId}/customers/${customerKey(input.customerPhone, input.customerName)}`) : null;
    const customerSnap = customerDocRef ? await tx.get(customerDocRef) : null;
    if (source === 'online' && paymentMode === 'salon') {
      const st = salon['settings'] ?? {};
      if (st.allowPayAtSalon === false) fail('failed-precondition', 'This salon accepts online payment only.', { reason: 'pay-at-salon-off' });
      const misses = (customerSnap?.data()?.['noShowCount'] as number | undefined) ?? 0;
      if (st.requireOnlineAfterNoShows && misses >= (st.noShowThreshold ?? 2)) fail('failed-precondition', 'Online payment is required after missed appointments.', { reason: 'no-show-block' });
    }

    const serviceSnaps = await Promise.all(input.serviceIds.map((id) => tx.get(d.db.doc(`salons/${input.salonId}/services/${id}`))));
    const services: PricedService[] = serviceSnaps.map((s, i) => {
      if (!s.exists || s.get('active') === false) fail('failed-precondition', MESSAGES.badInput, { reason: 'service-unavailable', serviceId: input.serviceIds[i] });
      return { serviceId: s.id, name: s.get('name'), price: s.get('price'), duration: s.get('duration') };
    });
    const priced = priceServices(services);
    const price = priced.price;
    const duration = source === 'owner' && input.durationOverride ? input.durationOverride : priced.duration;
    const end = input.start + duration;
    const violation = checkSalonRules(effectiveTiming(salon['timings'], salon['holidays'] ?? [], input.date), salon['breaks'], input.start, duration);
    if (violation) fail('failed-precondition', MESSAGES.badInput, { reason: 'salon-rules', violation });

    // Candidate stylists: the requested one, or every eligible one for 'any'.
    const staffSnaps =
      input.staffId === 'any'
        ? (await tx.get(d.db.collection(`salons/${input.salonId}/staff`))).docs
        : [await tx.get(d.db.doc(`salons/${input.salonId}/staff/${input.staffId}`))];
    const wd = weekdayIndex(input.date);
    const candidates = staffSnaps.filter(
      (s) => s.exists && s.get('active') !== false && s.get('days')?.[wd] === true && input.serviceIds.every((id) => (s.get('serviceIds') ?? []).includes(id)),
    );
    if (!candidates.length) fail('failed-precondition', MESSAGES.slotTaken, { reason: 'no-eligible-staff' });

    const dayRefs = candidates.map((s) => d.db.doc(`salons/${input.salonId}/staffDays/${staffDayId(s.id, input.date)}`));
    const daySnaps = await Promise.all(dayRefs.map((r) => tx.get(r)));

    let chosen = -1;
    let busyList: Busy[] = [];
    for (let i = 0; i < candidates.length; i++) {
      // Expired holds no longer block the slot.
      const live = ((daySnaps[i].data()?.['busy'] ?? []) as Busy[]).filter((x) => !x.holdUntil || x.holdUntil.toMillis() > now.getTime());
      if (!live.some((x) => overlaps(input.start, end, x.start, x.end))) {
        chosen = i;
        busyList = live;
        break;
      }
    }
    if (chosen < 0) fail('failed-precondition', MESSAGES.slotTaken, { reason: 'slot-busy' });

    const staff = candidates[chosen];
    const holdUntil = Timestamp.fromMillis(now.getTime() + HOLD_TTL_MS);
    const stamp = Timestamp.fromDate(now);
    const confirmed = mode === 'confirmed';
    const bookingNo = `CH-${bookingId.slice(0, 6).toUpperCase()}`;
    tx.set(dayRefs[chosen], { busy: [...busyList, confirmed ? { bookingId, start: input.start, end } : { bookingId, start: input.start, end, holdUntil }] });
    if (customerDocRef) {
      const existingCustomer = customerSnap?.data();
      const fresh = { visits: 0, totalSpent: 0, noShowCount: 0, lastVisit: '', uid: null };
      tx.set(
        customerDocRef,
        {
          ...(existingCustomer ? {} : fresh),
          name: existingCustomer?.['name'] || input.customerName,
          phone: existingCustomer?.['phone'] || input.customerPhone,
          // Link the login to the record only once; a second account using the same phone must not take it over.
          ...(customerId && !existingCustomer?.['uid'] ? { uid: customerId } : {}),
        },
        { merge: true },
      );
    }
    tx.set(bookingRef, {
      bookingNo,
      salonId: input.salonId,
      salonName: salon['profile']?.name ?? '',
      salonSlug: salon['slug'] ?? '',
      salonAddress: [salon['profile']?.street, salon['profile']?.city].filter(Boolean).join(', '),
      staffName: staff.get('name') ?? '',
      customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      staffId: staff.id,
      date: input.date,
      start: input.start,
      end,
      duration,
      services: services.map((s) => ({ serviceId: s.serviceId, name: s.name, price: s.price, duration: s.duration })),
      price,
      status: confirmed ? 'confirmed' : 'held',
      source,
      ...(input.notes ? { notes: input.notes } : {}),
      // Simulated checkout (PAYMENTS_LIVE off): an online booking is recorded as paid by the mock provider.
      payment: confirmed && paymentMode === 'online' ? { mode: 'online', status: 'paid', provider: 'mock' } : { mode: paymentMode, status: 'none' },
      ...(confirmed ? { confirmedAt: stamp } : { holdExpiresAt: holdUntil }),
      createdAt: stamp,
      updatedAt: stamp,
    });
    return { bookingId, holdExpiresAt: holdUntil.toDate(), staffId: staff.id, price, created: true, bookingNo, status: confirmed ? 'confirmed' : 'held' };
  });
}

/**
 * Expires held bookings whose hold ran out (customer abandoned checkout) and frees their slot.
 * Idempotent and safe to run often. A booking whose payment was captured is never expired here.
 */
export async function releaseExpiredHolds(d: BaseDeps, limit = 200): Promise<number> {
  const now = d.now();
  const q = await d.db
    .collectionGroup('bookings')
    .where('status', '==', 'held')
    .where('holdExpiresAt', '<=', Timestamp.fromDate(now))
    .limit(limit)
    .get();

  let released = 0;
  for (const doc of q.docs) {
    const ok = await d.db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const b = snap.data();
      if (!b || b['status'] !== 'held' || !b['holdExpiresAt'] || b['holdExpiresAt'].toMillis() > now.getTime()) return false;
      if (b['payment']?.status === 'paid') return false;
      const salonId = doc.ref.parent.parent!.id;
      const dayRef = d.db.doc(`salons/${salonId}/staffDays/${staffDayId(b['staffId'], b['date'])}`);
      const day = await tx.get(dayRef);
      const busy = ((day.data()?.['busy'] ?? []) as Busy[]).filter((x) => x.bookingId !== snap.id);
      if (day.exists) tx.set(dayRef, { busy });
      tx.update(doc.ref, { status: 'expired', updatedAt: Timestamp.fromDate(now) });
      return true;
    });
    if (ok) released++;
  }
  if (released) logger.info('released expired holds', { released });
  return released;
}
