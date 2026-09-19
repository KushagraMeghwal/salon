import { FieldPath, Timestamp, type DocumentReference, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { fail, MESSAGES } from '../lib/errors';
import type { CallerAuth } from '../lib/auth';
import type { BaseDeps } from '../razorpay/types';
import {
  addDays, bookingStartMs, cancellationFee, checkSalonRules, customerKey, effectiveTiming, istNow, overlaps, phoneKey, weekdayIndex,
} from '../../../shared/src';
import { staffDayId } from './hold';

interface Busy {
  bookingId: string;
  start: number;
  end: number;
  holdUntil?: Timestamp;
}

export type ChangeAction = 'cancel' | 'reschedule' | 'start' | 'complete' | 'no-show' | 'delay' | 'addon';

export interface ChangeInput {
  salonId: string;
  bookingId: string;
  action: ChangeAction;
  date?: string;
  start?: number;
  minutes?: number;
  serviceId?: string;
}

type Who = 'owner' | 'staff' | 'customer';

const OPEN_STATUSES = ['confirmed', 'vip'];

/** Busy list without holds that already ran out. */
const liveBusy = (snap: DocumentSnapshot, now: Date): Busy[] =>
  ((snap.data()?.['busy'] ?? []) as Busy[]).filter((x) => !x.holdUntil || x.holdUntil.toMillis() > now.getTime());

/**
 * One entry point for everything that changes an existing booking. Every path keeps the per-stylist per-day lock
 * (staffDays) in step with the booking, so the calendar and the customer availability can never disagree.
 */
export async function changeBooking(d: BaseDeps, actor: CallerAuth, input: ChangeInput): Promise<{ status: string; cancelFee: number }> {
  const now = d.now();
  const nowIst = istNow(now);
  const salonRef = d.db.doc(`salons/${input.salonId}`);
  const bookingRef = d.db.doc(`salons/${input.salonId}/bookings/${input.bookingId}`);

  return d.db.runTransaction(async (tx: Transaction) => {
    const [salonSnap, bookingSnap] = await Promise.all([tx.get(salonRef), tx.get(bookingRef)]);
    if (!salonSnap.exists || !bookingSnap.exists) fail('not-found', MESSAGES.notFound);
    const salon = salonSnap.data()!;
    const b = bookingSnap.data()!;

    const claimed = Array.isArray(actor.token.salonIds) && actor.token.salonIds.includes(input.salonId);
    const who: Who | null =
      actor.token.role === 'superadmin' || salon['ownerId'] === actor.uid || (actor.token.role === 'owner' && claimed)
        ? 'owner'
        : actor.token.role === 'staff' && claimed && actor.token['staffId'] === b['staffId']
          ? 'staff'
          : b['customerId'] && b['customerId'] === actor.uid
            ? 'customer'
            : null;
    if (!who) fail('permission-denied', MESSAGES.forbidden, { reason: 'not-allowed', uid: actor.uid });
    const staffSide = who === 'owner' || who === 'staff';

    const status = b['status'] as string;
    const oldDayRef = d.db.doc(`salons/${input.salonId}/staffDays/${staffDayId(b['staffId'], b['date'])}`);
    const reads: Promise<DocumentSnapshot>[] = [tx.get(oldDayRef)];
    let newDate = b['date'] as string;
    let newDayRef: DocumentReference = oldDayRef;
    if (input.action === 'reschedule') {
      if (!input.date || input.start === undefined) fail('invalid-argument', MESSAGES.badInput);
      newDate = input.date;
      newDayRef = d.db.doc(`salons/${input.salonId}/staffDays/${staffDayId(b['staffId'], newDate)}`);
      if (newDate !== b['date']) reads.push(tx.get(newDayRef));
    }
    const needsStaffDoc = ['reschedule', 'delay', 'addon'].includes(input.action);
    const staffSnap = needsStaffDoc ? await tx.get(d.db.doc(`salons/${input.salonId}/staff/${b['staffId']}`)) : null;
    const addonSnap = input.action === 'addon' && input.serviceId ? await tx.get(d.db.doc(`salons/${input.salonId}/services/${input.serviceId}`)) : null;
    const customerRef = phoneKey(b['customerPhone'] ?? '') ? d.db.doc(`salons/${input.salonId}/customers/${customerKey(b['customerPhone'], b['customerName'])}`) : null;
    const customerSnap = customerRef && ['complete', 'no-show'].includes(input.action) ? await tx.get(customerRef) : null;
    const [oldDay, newDay] = await Promise.all(reads);
    const stamp = Timestamp.fromDate(now);

    /** Re-checks salon rules, the stylist's working day and clashes for a candidate placement. */
    const assertFits = (date: string, start: number, duration: number, busy: Busy[]) => {
      const t = effectiveTiming(salon['timings'], salon['holidays'] ?? [], date);
      const violation = checkSalonRules(t, salon['breaks'], start, duration);
      if (violation) fail('failed-precondition', MESSAGES.badInput, { reason: 'salon-rules', violation });
      const s = staffSnap?.data();
      if (!s || s['active'] === false || s['days']?.[weekdayIndex(date)] !== true) fail('failed-precondition', 'This stylist is not working on that day.');
      if (busy.some((x) => x.bookingId !== input.bookingId && overlaps(start, start + duration, x.start, x.end))) fail('failed-precondition', MESSAGES.slotTaken, { reason: 'slot-busy' });
    };
    const without = (list: Busy[]) => list.filter((x) => x.bookingId !== input.bookingId);

    switch (input.action) {
      case 'cancel': {
        if (who === 'staff' || !['confirmed', 'held', 'vip'].includes(status)) fail('failed-precondition', 'This booking can no longer be cancelled.');
        const fee =
          who === 'customer'
            ? cancellationFee({
                price: b['price'],
                hoursUntil: (bookingStartMs(b['date'], b['start']) - now.getTime()) / 3600000,
                cancelWindowHrs: salon['settings']?.cancelWindowHrs ?? 2,
                latePenaltyPct: salon['settings']?.latePenaltyPct ?? 15,
              })
            : 0;
        const paid = b['payment']?.status === 'paid' && b['payment']?.provider === 'razorpay';
        tx.set(oldDayRef, { busy: without(liveBusy(oldDay, now)) });
        tx.update(bookingRef, { status: 'cancelled', cancelledAt: stamp, cancelFee: fee, updatedAt: stamp, ...(paid ? { 'payment.refundRequired': true } : {}) });
        return { status: 'cancelled', cancelFee: fee };
      }

      case 'reschedule': {
        if (staffSide && who !== 'owner') fail('permission-denied', MESSAGES.forbidden);
        if (!['confirmed', 'vip'].includes(status)) fail('failed-precondition', 'This booking can no longer be moved.');
        const start = input.start!;
        if (newDate < nowIst.date || (newDate === nowIst.date && start < nowIst.minutes + (who === 'owner' ? -60 : 15))) fail('invalid-argument', MESSAGES.badInput, { reason: 'in-the-past' });
        const sameDay = newDate === b['date'];
        const targetBusy = liveBusy(sameDay ? oldDay : newDay, now);
        assertFits(newDate, start, b['duration'], targetBusy);
        const fee =
          who === 'customer'
            ? cancellationFee({
                price: b['price'],
                hoursUntil: (bookingStartMs(b['date'], b['start']) - now.getTime()) / 3600000,
                cancelWindowHrs: salon['settings']?.cancelWindowHrs ?? 2,
                latePenaltyPct: salon['settings']?.latePenaltyPct ?? 15,
              })
            : 0;
        const entry: Busy = { bookingId: input.bookingId, start, end: start + b['duration'] };
        if (sameDay) tx.set(oldDayRef, { busy: [...without(targetBusy), entry] });
        else {
          tx.set(oldDayRef, { busy: without(liveBusy(oldDay, now)) });
          tx.set(newDayRef, { busy: [...targetBusy, entry] });
        }
        tx.update(bookingRef, { date: newDate, start, end: start + b['duration'], updatedAt: stamp, rescheduledAt: stamp, cancelFee: fee });
        return { status, cancelFee: fee };
      }

      case 'start':
      case 'complete':
      case 'no-show': {
        if (!staffSide) fail('permission-denied', MESSAGES.forbidden);
        const allowed = input.action === 'start' ? OPEN_STATUSES : input.action === 'complete' ? [...OPEN_STATUSES, 'in-progress'] : OPEN_STATUSES;
        if (!allowed.includes(status)) fail('failed-precondition', 'This booking cannot be changed to that status right now.');
        const next = input.action === 'start' ? 'in-progress' : input.action === 'complete' ? 'completed' : 'no-show';
        if (input.action === 'no-show') tx.set(oldDayRef, { busy: without(liveBusy(oldDay, now)) });
        if (customerRef && customerSnap) {
          const c = customerSnap.data() ?? {};
          if (input.action === 'complete' && !b['billed']) {
            tx.set(customerRef, { name: c['name'] || b['customerName'], phone: c['phone'] || b['customerPhone'], uid: c['uid'] ?? b['customerId'] ?? null, noShowCount: c['noShowCount'] ?? 0, visits: (c['visits'] ?? 0) + 1, totalSpent: (c['totalSpent'] ?? 0) + b['price'], lastVisit: b['date'] }, { merge: true });
          }
          if (input.action === 'no-show') {
            tx.set(customerRef, { name: c['name'] || b['customerName'], phone: c['phone'] || b['customerPhone'], uid: c['uid'] ?? b['customerId'] ?? null, visits: c['visits'] ?? 0, totalSpent: c['totalSpent'] ?? 0, lastVisit: c['lastVisit'] ?? '', noShowCount: (c['noShowCount'] ?? 0) + 1 }, { merge: true });
          }
        }
        tx.update(bookingRef, { status: next, updatedAt: stamp });
        return { status: next, cancelFee: 0 };
      }

      case 'delay': {
        if (!staffSide) fail('permission-denied', MESSAGES.forbidden);
        const minutes = Math.round(input.minutes ?? 0);
        if (minutes < 5 || minutes > 120) fail('invalid-argument', MESSAGES.badInput);
        if (!OPEN_STATUSES.includes(status)) fail('failed-precondition', 'This booking cannot be moved right now.');
        const start = b['start'] + minutes;
        const busy = liveBusy(oldDay, now);
        assertFits(b['date'], start, b['duration'], busy);
        tx.set(oldDayRef, { busy: [...without(busy), { bookingId: input.bookingId, start, end: start + b['duration'] }] });
        tx.update(bookingRef, { start, end: start + b['duration'], updatedAt: stamp });
        return { status, cancelFee: 0 };
      }

      case 'addon': {
        if (!staffSide) fail('permission-denied', MESSAGES.forbidden);
        if (![...OPEN_STATUSES, 'in-progress'].includes(status)) fail('failed-precondition', 'This booking cannot be changed right now.');
        if (!addonSnap?.exists || addonSnap.get('active') === false) fail('not-found', MESSAGES.notFound);
        if (!(staffSnap?.data()?.['serviceIds'] ?? []).includes(addonSnap.id)) fail('failed-precondition', 'This stylist does not offer that service.');
        const add = { serviceId: addonSnap.id, name: addonSnap.get('name'), price: addonSnap.get('price'), duration: addonSnap.get('duration') };
        const duration = b['duration'] + add.duration;
        const busy = liveBusy(oldDay, now);
        assertFits(b['date'], b['start'], duration, busy);
        tx.set(oldDayRef, { busy: [...without(busy), { bookingId: input.bookingId, start: b['start'], end: b['start'] + duration }] });
        tx.update(bookingRef, { services: [...(b['services'] ?? []), add], price: b['price'] + add.price, duration, end: b['start'] + duration, updatedAt: stamp });
        return { status, cancelFee: 0 };
      }
    }
  });
}

export interface BusyRow {
  bookingId: string;
  staffId: string;
  date: string;
  start: number;
  end: number;
}

/**
 * Public availability: which stretches of each stylist's day are taken, with no customer details. The customer
 * app draws "Booked" slots from this; the booking transaction stays the only authority.
 */
export async function getBusy(d: BaseDeps, salonId: string, from: string, days: number): Promise<BusyRow[]> {
  const now = d.now();
  const to = addDays(from, Math.max(1, Math.min(31, days)) - 1);
  const staff = await d.db.collection(`salons/${salonId}/staff`).get();
  const out: BusyRow[] = [];
  await Promise.all(
    staff.docs
      .filter((s) => s.get('active') !== false)
      .map(async (s) => {
        const snap = await d.db
          .collection(`salons/${salonId}/staffDays`)
          .where(FieldPath.documentId(), '>=', staffDayId(s.id, from))
          .where(FieldPath.documentId(), '<=', staffDayId(s.id, to))
          .get();
        for (const day of snap.docs) {
          const date = day.id.slice(s.id.length + 1);
          for (const x of liveBusy(day, now)) out.push({ bookingId: x.bookingId, staffId: s.id, date, start: x.start, end: x.end });
        }
      }),
  );
  return out;
}
