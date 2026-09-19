import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBill, financialYear } from '../src/billing/bill';
import { createBooking } from '../src/bookings/hold';
import { changeBooking, getBusy } from '../src/bookings/manage';
import { adminSalonAction, completeOnboarding, expireTrials } from '../src/salon/setup';
import type { CallerAuth } from '../src/lib/auth';

const A = 'salonA';
// 2030-06-03 is a Monday; 06:00Z = 11:30 IST.
const T0 = new Date('2030-06-03T06:00:00Z').getTime();
const DATE = '2030-06-05';
const START = 14 * 60;

let db: Firestore;
let clock = T0;
const deps = () => ({ db, now: () => new Date(clock) });

const owner: CallerAuth = { uid: 'owner1', token: { role: 'owner', salonIds: [A] } };
const customer = (uid = 'cust1'): CallerAuth => ({ uid, token: {} });
const stranger: CallerAuth = { uid: 'nobody', token: {} };

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: 'demo-chairly' });
  db = getFirestore();
});

async function wipe() {
  for (const path of ['salons', 'slugs']) await db.recursiveDelete(db.collection(path));
}

async function seedSalon(id = A, extra: Record<string, unknown> = {}) {
  await db.doc(`salons/${id}`).set({
    ownerId: 'owner1', status: 'active', bookable: true, slug: '', profile: { name: `Salon ${id}`, street: '1 Main', city: 'Pune' },
    timings: Array.from({ length: 7 }, () => ({ open: true, start: '09:00', end: '21:00' })),
    breaks: { enabled: false, start: '13:00', end: '14:00', blockSlots: false }, holidays: [],
    settings: { allowPayAtSalon: true, requireOnlineAfterNoShows: true, noShowThreshold: 2, cancelWindowHrs: 2, latePenaltyPct: 15, gstRegistered: false, gstin: '' },
    ...extra,
  });
  await db.doc(`salons/${id}/services/sv1`).set({ name: 'Haircut', price: 500, duration: 60, active: true });
  await db.doc(`salons/${id}/services/sv2`).set({ name: 'Beard', price: 250, duration: 30, active: true });
  await db.doc(`salons/${id}/staff/st1`).set({ name: 'Vikram', active: true, serviceIds: ['sv1', 'sv2'], days: [true, true, true, true, true, true, true] });
  await db.doc(`salons/${id}/staff/st2`).set({ name: 'Aarav', active: true, serviceIds: ['sv1'], days: [true, true, true, true, true, true, true] });
}

const book = (uid: string, over: Record<string, unknown> = {}) =>
  createBooking(deps(), {
    uid, salonId: A, requestId: `req-${uid}-${Math.random().toString(36).slice(2, 8)}`, serviceIds: ['sv1'], staffId: 'st1', date: DATE, start: START,
    customerName: 'Ananya Roy', customerPhone: '9876543210', mode: 'confirmed', source: 'online', paymentMode: 'salon', ...over,
  });

const busy = async (staff = 'st1', date = DATE) => ((await db.doc(`salons/${A}/staffDays/${staff}_${date}`).get()).data()?.['busy'] ?? []) as { bookingId: string; start: number; end: number }[];
const bookingDoc = async (id: string) => (await db.doc(`salons/${A}/bookings/${id}`).get()).data()!;

beforeEach(async () => {
  clock = T0;
  await wipe();
  await seedSalon();
});

describe('confirmed bookings', () => {
  it('pay-at-salon confirms straight away, locks the stylist and links the customer record', async () => {
    const r = await book('cust1');
    expect(r.status).toBe('confirmed');
    const b = await bookingDoc(r.bookingId);
    expect(b).toMatchObject({ status: 'confirmed', customerId: 'cust1', salonId: A, salonName: `Salon ${A}`, staffName: 'Vikram', source: 'online', payment: { mode: 'salon', status: 'none' } });
    expect(await busy()).toEqual([{ bookingId: r.bookingId, start: START, end: START + 60 }]);
    const c = (await db.doc(`salons/${A}/customers/p_9876543210`).get()).data();
    expect(c).toMatchObject({ uid: 'cust1', name: 'Ananya Roy', visits: 0, noShowCount: 0 });
  });

  it('simulated online payment is recorded as paid by the mock provider', async () => {
    const r = await book('cust1', { paymentMode: 'online' });
    expect((await bookingDoc(r.bookingId)).payment).toMatchObject({ mode: 'online', status: 'paid', provider: 'mock' });
  });

  it('is idempotent: the same request id returns the same booking and never double-books', async () => {
    const a = await book('cust1', { requestId: 'same-request-1' });
    const b = await book('cust1', { requestId: 'same-request-1' });
    expect(b.bookingId).toBe(a.bookingId);
    expect(await busy()).toHaveLength(1);
  });

  it('two customers racing for the same slot: exactly one wins', async () => {
    const results = await Promise.allSettled([book('cust1'), book('cust2'), book('cust3')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(2);
    expect(await busy()).toHaveLength(1);
  });

  it('"any" stylist falls through to the next free stylist', async () => {
    const a = await book('cust1', { staffId: 'any' });
    const b = await book('cust2', { staffId: 'any' });
    expect(new Set([a.staffId, b.staffId]).size).toBe(2);
    await expect(book('cust3', { staffId: 'any' })).rejects.toThrow();
  });

  it('refuses a salon that is not bookable (e.g. trial ended) but lets the owner still add appointments', async () => {
    await db.doc(`salons/${A}`).update({ bookable: false });
    await expect(book('cust1')).rejects.toThrow();
    const r = await book('owner1', { source: 'owner', customerId: null, mode: 'confirmed' });
    expect((await bookingDoc(r.bookingId)).customerId).toBeNull();
  });

  it('blocks pay-at-salon after repeated no-shows when the salon requires online payment', async () => {
    await db.doc(`salons/${A}/customers/p_9876543210`).set({ name: 'Ananya Roy', phone: '9876543210', noShowCount: 2, visits: 1, totalSpent: 0, lastVisit: '' });
    await expect(book('cust1', { paymentMode: 'salon' })).rejects.toThrow(/online payment/i);
    await expect(book('cust1', { paymentMode: 'online' })).resolves.toBeTruthy();
  });

  it('does not let a second login take over an existing customer record', async () => {
    await book('cust1');
    await book('cust2', { start: START + 120 });
    expect((await db.doc(`salons/${A}/customers/p_9876543210`).get()).get('uid')).toBe('cust1');
  });

  it('rejects the past and slots outside working hours', async () => {
    await expect(book('cust1', { date: '2030-06-02' })).rejects.toThrow();
    await expect(book('cust1', { start: 22 * 60 })).rejects.toThrow();
  });
});

describe('changing a booking', () => {
  it('a customer cancelling early pays no fee and frees the slot', async () => {
    const r = await book('cust1');
    const out = await changeBooking(deps(), customer(), { salonId: A, bookingId: r.bookingId, action: 'cancel' });
    expect(out).toEqual({ status: 'cancelled', cancelFee: 0 });
    expect(await busy()).toEqual([]);
    await expect(book('cust2')).resolves.toBeTruthy();
  });

  it('a late customer cancellation records the salon policy fee', async () => {
    const r = await book('cust1', { date: '2030-06-03', start: 13 * 60 }); // 13:00 IST, "now" is 11:30 -> 1.5h away, window is 2h
    const out = await changeBooking(deps(), customer(), { salonId: A, bookingId: r.bookingId, action: 'cancel' });
    expect(out.cancelFee).toBe(75); // 15% of 500
  });

  it('strangers cannot change anyone else’s booking; other customers neither', async () => {
    const r = await book('cust1');
    await expect(changeBooking(deps(), stranger, { salonId: A, bookingId: r.bookingId, action: 'cancel' })).rejects.toThrow(/access/i);
    await expect(changeBooking(deps(), customer('cust2'), { salonId: A, bookingId: r.bookingId, action: 'cancel' })).rejects.toThrow(/access/i);
  });

  it('a customer cannot mark their own booking completed or no-show', async () => {
    const r = await book('cust1');
    await expect(changeBooking(deps(), customer(), { salonId: A, bookingId: r.bookingId, action: 'complete' })).rejects.toThrow();
    await expect(changeBooking(deps(), customer(), { salonId: A, bookingId: r.bookingId, action: 'no-show' })).rejects.toThrow();
  });

  it('reschedule moves the lock to the new day and rejects a clash', async () => {
    const r = await book('cust1');
    const other = await book('cust2', { start: START + 120 });
    await expect(changeBooking(deps(), customer(), { salonId: A, bookingId: r.bookingId, action: 'reschedule', date: DATE, start: START + 120 })).rejects.toThrow(/taken/i);

    await changeBooking(deps(), customer(), { salonId: A, bookingId: r.bookingId, action: 'reschedule', date: '2030-06-06', start: 10 * 60 });
    expect((await busy('st1', DATE)).map((x) => x.bookingId)).toEqual([other.bookingId]);
    expect(await busy('st1', '2030-06-06')).toEqual([{ bookingId: r.bookingId, start: 600, end: 660 }]);
    expect(await bookingDoc(r.bookingId)).toMatchObject({ date: '2030-06-06', start: 600 });
  });

  it('staff of that stylist can start and complete; completion counts a visit once', async () => {
    const r = await book('cust1');
    const st1: CallerAuth = { uid: 'staffUser', token: { role: 'staff', salonIds: [A], staffId: 'st1' } };
    const st2: CallerAuth = { uid: 'staffUser2', token: { role: 'staff', salonIds: [A], staffId: 'st2' } };
    await expect(changeBooking(deps(), st2, { salonId: A, bookingId: r.bookingId, action: 'start' })).rejects.toThrow(/access/i);
    await changeBooking(deps(), st1, { salonId: A, bookingId: r.bookingId, action: 'start' });
    await changeBooking(deps(), st1, { salonId: A, bookingId: r.bookingId, action: 'complete' });
    await expect(changeBooking(deps(), st1, { salonId: A, bookingId: r.bookingId, action: 'complete' })).rejects.toThrow();
    expect((await db.doc(`salons/${A}/customers/p_9876543210`).get()).data()).toMatchObject({ visits: 1, totalSpent: 500, lastVisit: DATE });
  });

  it('no-show counts against the customer and frees the slot', async () => {
    const r = await book('cust1');
    await changeBooking(deps(), owner, { salonId: A, bookingId: r.bookingId, action: 'no-show' });
    expect((await db.doc(`salons/${A}/customers/p_9876543210`).get()).get('noShowCount')).toBe(1);
    expect(await busy()).toEqual([]);
  });

  it('delay and add-on keep the lock in step and respect the next booking', async () => {
    const r = await book('cust1');
    await book('cust2', { start: START + 70, serviceIds: ['sv2'] }); // 15:10-15:40
    await expect(changeBooking(deps(), owner, { salonId: A, bookingId: r.bookingId, action: 'delay', minutes: 30 })).rejects.toThrow(/taken/i);
    await changeBooking(deps(), owner, { salonId: A, bookingId: r.bookingId, action: 'delay', minutes: 10 });
    expect((await bookingDoc(r.bookingId)).start).toBe(START + 10);
    await expect(changeBooking(deps(), owner, { salonId: A, bookingId: r.bookingId, action: 'addon', serviceId: 'sv2' })).rejects.toThrow(/taken/i);
  });
});

describe('public availability', () => {
  it('returns only taken stretches (no customer details) and drops expired holds', async () => {
    const r = await book('cust1');
    await db.doc(`salons/${A}/staffDays/st2_${DATE}`).set({
      busy: [{ bookingId: 'held-expired', start: 600, end: 660, holdUntil: Timestamp.fromMillis(T0 - 1000) }, { bookingId: 'held-live', start: 700, end: 760, holdUntil: Timestamp.fromMillis(T0 + 60_000) }],
    });
    const rows = await getBusy(deps(), A, DATE, 3);
    expect(rows).toEqual(expect.arrayContaining([{ bookingId: r.bookingId, staffId: 'st1', date: DATE, start: START, end: START + 60 }, { bookingId: 'held-live', staffId: 'st2', date: DATE, start: 700, end: 760 }]));
    expect(rows.find((x) => x.bookingId === 'held-expired')).toBeUndefined();
    expect(Object.keys(rows[0]).sort()).toEqual(['bookingId', 'date', 'end', 'staffId', 'start']);
  });
});

describe('billing', () => {
  const input = (over: Record<string, unknown> = {}) => ({
    salonId: A, client: 'Ananya Roy', phone: '9876543210', method: 'UPI' as const, discount: 0,
    lines: [{ serviceId: 'sv1', name: 'Haircut', price: 500, qty: 2, staffId: 'st1' }], ...over,
  });

  it('issues sequential GST-ready invoice numbers per financial year and updates the customer', async () => {
    const a = await createBill(deps(), input());
    const b = await createBill(deps(), input({ client: 'Second', phone: '' }));
    expect(a['no']).toBe('CH/30-31/00001'); // 3 Jun 2030 is in FY 2030-31
    expect(b['no']).toBe('CH/30-31/00002');
    expect(a).toMatchObject({ total: 1000, subtotal: 1000, gst: 0, gstRegistered: false });
    expect((await db.doc(`salons/${A}/customers/p_9876543210`).get()).data()).toMatchObject({ visits: 1, totalSpent: 1000 });
    expect((await db.doc(`salons/${A}/bills/CH-30-31-00001`).get()).exists).toBe(true);
  });

  it('splits GST when the salon is registered, and clamps a discount to the subtotal', async () => {
    await db.doc(`salons/${A}`).update({ 'settings.gstRegistered': true, 'settings.gstin': '27ABCDE1234F1Z5' });
    const bill = await createBill(deps(), input({ discount: 5000 }));
    expect(bill).toMatchObject({ discount: 1000, total: 0 });
    const bill2 = await createBill(deps(), input({ discount: 100 }));
    expect(bill2['total']).toBe(900);
    expect((bill2['taxable'] as number) + (bill2['cgst'] as number) + (bill2['sgst'] as number)).toBe(900);
  });

  it('stamps the walk-in queue entry as done and creates one for a plain bill', async () => {
    await db.doc(`salons/${A}/queue/q1`).set({ stage: 'in-chair', client: 'Amit', price: 500, date: '2030-06-03' });
    const bill = await createBill(deps(), input({ queueId: 'q1' }));
    expect((await db.doc(`salons/${A}/queue/q1`).get()).data()).toMatchObject({ stage: 'done', billNo: bill['no'], payMethod: 'UPI', price: 1000 });
    const plain = await createBill(deps(), input());
    expect((await db.doc(`salons/${A}/queue/q_${String(plain['no']).replace(/\//g, '-')}`).get()).data()).toMatchObject({ stage: 'done', date: '2030-06-03' });
  });

  it('billing a booking marks it billed and does not count its visit twice', async () => {
    const r = await book('cust1');
    await changeBooking(deps(), owner, { salonId: A, bookingId: r.bookingId, action: 'complete' });
    await createBill(deps(), input({ bookingId: r.bookingId, lines: [{ serviceId: 'sv1', name: 'Haircut', price: 500, qty: 1, staffId: 'st1' }] }));
    expect((await bookingDoc(r.bookingId)).billed).toBe(true);
    expect((await db.doc(`salons/${A}/customers/p_9876543210`).get()).get('visits')).toBe(1);
  });

  it('financial year rolls over on 1 April', () => {
    expect(financialYear('2027-03-31')).toBe('26-27');
    expect(financialYear('2027-04-01')).toBe('27-28');
  });
});

describe('onboarding, plans and trials', () => {
  it('completeOnboarding needs a service and a stylist, then claims a unique slug', async () => {
    await db.doc(`salons/${A}`).update({ status: 'draft', bookable: false, slug: '', 'profile.name': 'Luxe & Co' });
    await db.doc(`salons/${A}/private/billing`).set({ plan: 'Trial', status: 'trial', trialEndsAt: Timestamp.fromMillis(T0 + 86_400_000) });
    const res = await completeOnboarding(deps(), A);
    expect(res.slug).toBe('luxe-and-co');
    expect((await db.doc(`salons/${A}`).get()).data()).toMatchObject({ status: 'active', bookable: true, slug: 'luxe-and-co' });
    expect((await db.doc('slugs/luxe-and-co').get()).get('salonId')).toBe(A);
    expect((await completeOnboarding(deps(), A)).slug).toBe('luxe-and-co'); // idempotent

    await seedSalon('salonB', { ownerId: 'owner2', status: 'draft', bookable: false, profile: { name: 'Luxe & Co' } });
    await db.doc('salons/salonB/private/billing').set({ plan: 'Trial', status: 'trial', trialEndsAt: Timestamp.fromMillis(T0 + 86_400_000) });
    expect((await completeOnboarding(deps(), 'salonB')).slug).toBe('luxe-and-co-2'); // two salons never share a link

    await db.doc(`salons/salonB/services/sv1`).update({ active: false });
    await db.doc(`salons/salonB/services/sv2`).update({ active: false });
    await db.doc('salons/salonB').update({ slug: '' });
    await expect(completeOnboarding(deps(), 'salonB')).rejects.toThrow(/service/i);
  });

  it('trials that ran out stop taking bookings; extending the trial reopens them', async () => {
    await db.doc(`salons/${A}/private/billing`).set({ plan: 'Trial', status: 'trial', trialEndsAt: Timestamp.fromMillis(T0 - 1000) });
    expect(await expireTrials(deps())).toBe(1);
    expect((await db.doc(`salons/${A}`).get()).get('bookable')).toBe(false);
    expect((await db.doc(`salons/${A}/private/billing`).get()).get('status')).toBe('expired');

    await db.doc(`salons/${A}`).update({ slug: 'salon-a' });
    await adminSalonAction(deps(), { salonId: A, action: 'extendTrial', days: 7 });
    expect((await db.doc(`salons/${A}`).get()).get('bookable')).toBe(true);
    await adminSalonAction(deps(), { salonId: A, action: 'suspend' });
    expect((await db.doc(`salons/${A}`).get()).data()).toMatchObject({ status: 'suspended', bookable: false });
    await adminSalonAction(deps(), { salonId: A, action: 'reactivate' });
    expect((await db.doc(`salons/${A}`).get()).data()).toMatchObject({ status: 'active', bookable: true });
  });
});
