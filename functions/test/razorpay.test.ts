import { createHmac } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertSalonOwner } from '../src/lib/auth';
import { sha256 } from '../src/lib/signature';
import { createHeldBooking, releaseExpiredHolds } from '../src/bookings/hold';
import { disconnect, handleCallback, initiateConnect } from '../src/razorpay/connect';
import { FakeRazorpayConnectService } from '../src/razorpay/fakeConnectService';
import { createPaymentOrder } from '../src/razorpay/payments';
import { COL, type Deps } from '../src/razorpay/types';
import { processWebhook } from '../src/razorpay/webhook';

const SECRET = 'whsec_test';
const A = 'salonA';
const B = 'salonB';
// 2030-06-03 is a Monday; 06:00Z = 11:30 IST.
const T0 = new Date('2030-06-03T06:00:00Z').getTime();
const DATE = '2030-06-05';
const START = 14 * 60; // 14:00

let db: Firestore;
let svc: FakeRazorpayConnectService;
let clock = T0;
const deps = (): Deps => ({ db, svc, now: () => new Date(clock) });

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: 'demo-chairly' });
  db = getFirestore();
});

async function seedSalon(id: string, ownerId: string, over: Record<string, unknown> = {}) {
  await db.doc(`salons/${id}`).set({
    ownerId,
    status: 'active',
    bookable: true,
    profile: { name: id },
    timings: Array.from({ length: 7 }, () => ({ open: true, start: '09:00', end: '21:00' })),
    breaks: { enabled: false, start: '13:00', end: '14:00', blockSlots: false },
    holidays: [],
    ...over,
  });
  await db.doc(`salons/${id}/services/sv1`).set({ name: 'Haircut', price: 500, duration: 60, active: true });
  await db.doc(`salons/${id}/services/sv2`).set({ name: 'Beard', price: 250, duration: 30, active: true });
  await db.doc(`salons/${id}/staff/st1`).set({ name: 'Vikram', active: true, serviceIds: ['sv1', 'sv2'], days: [true, true, true, true, true, true, true] });
}

async function connect(salonId: string, uid: string) {
  const { url } = await initiateConnect(deps(), { salonId, uid });
  const state = new URL(url).searchParams.get('state')!;
  const r = await handleCallback(deps(), { code: 'good-code', state });
  return { state, r };
}

const hold = (uid: string, over: Record<string, unknown> = {}) =>
  createHeldBooking(deps(), {
    uid, salonId: A, requestId: `req-${uid}-1`, serviceIds: ['sv1'], staffId: 'st1', date: DATE, start: START,
    customerName: 'Ananya Roy', customerPhone: '9876543210', ...over,
  });

function signed(event: unknown, secret = SECRET) {
  const rawBody = Buffer.from(JSON.stringify(event));
  return { rawBody, signature: createHmac('sha256', secret).update(rawBody).digest('hex'), secret };
}
const paymentEvent = (name: string, o: { orderId: string; bookingId: string; salon?: string; account?: string; amount?: number; paymentId?: string }) => ({
  event: name,
  account_id: o.account ?? 'acc_FAKE00000000001',
  payload: { payment: { entity: { id: o.paymentId ?? 'pay_1', order_id: o.orderId, amount: o.amount ?? 50000, method: 'upi', notes: { salonId: o.salon ?? A, bookingId: o.bookingId }, error_code: name === 'payment.failed' ? 'BAD_REQUEST_ERROR' : null } } },
});
const hook = (event: unknown, eventId: string, secret = SECRET) => processWebhook(deps(), { ...signed(event, secret), eventIdHeader: eventId });

const booking = async (id: string, salon = A) => (await db.doc(`salons/${salon}/bookings/${id}`)).get().then((s) => s.data()!);
const dayBusy = async (staff = 'st1') => ((await db.doc(`salons/${A}/staffDays/${staff}_${DATE}`).get()).data()?.['busy'] ?? []) as { bookingId: string; holdUntil?: Timestamp }[];

async function paidSetup() {
  const h = await hold('cust1');
  const o = await createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust1' });
  return { h, o };
}

beforeEach(async () => {
  for (const c of await db.listCollections()) await db.recursiveDelete(c);
  clock = T0;
  svc = new FakeRazorpayConnectService();
  await seedSalon(A, 'ownerA');
  await seedSalon(B, 'ownerB');
  await connect(A, 'ownerA');
});

describe('1. connect flow', () => {
  it('new salon -> callback -> CONNECTED, tokens only in the server-only collection', async () => {
    await seedSalon('fresh', 'ownerF');
    const { url } = await initiateConnect(deps(), { salonId: 'fresh', uid: 'ownerF' });
    expect(url).toContain('state=');
    expect((await db.doc('salons/fresh').get()).get('paymentConnection.status')).toBe('PENDING');

    const state = new URL(url).searchParams.get('state')!;
    // The state is stored hashed, keyed to salon + uid.
    const st = await db.doc(`${COL.oauthStates}/${sha256(state)}`).get();
    expect(st.data()).toMatchObject({ salonId: 'fresh', uid: 'ownerF', used: false });

    const r = await handleCallback(deps(), { code: 'good-code', state });
    expect(r).toEqual({ ok: true, salonId: 'fresh' });
    const salon = (await db.doc('salons/fresh').get()).data()!;
    expect(salon['paymentConnection']).toMatchObject({ status: 'CONNECTED', razorpayAccountId: 'acc_FAKE00000000001' });
    expect(JSON.stringify(salon)).not.toMatch(/acc_tok|ref_tok|rzp_test_oauth/);
    expect((await db.doc(`${COL.connections}/fresh`).get()).get('accessToken')).toMatch(/^acc_tok_/);
    expect((await db.doc(`${COL.oauthStates}/${sha256(state)}`).get()).exists).toBe(false);
  });

  it('OAuth denied or exchange failure -> FAILED with no leftover tokens', async () => {
    await seedSalon('f2', 'o2');
    const s1 = new URL((await initiateConnect(deps(), { salonId: 'f2', uid: 'o2' })).url).searchParams.get('state')!;
    expect(await handleCallback(deps(), { error: 'access_denied', state: s1 })).toMatchObject({ ok: false, reason: 'denied' });
    expect((await db.doc('salons/f2').get()).get('paymentConnection.status')).toBe('FAILED');

    const s2 = new URL((await initiateConnect(deps(), { salonId: 'f2', uid: 'o2' })).url).searchParams.get('state')!;
    svc.failNext = 'exchange';
    expect(await handleCallback(deps(), { code: 'x', state: s2 })).toMatchObject({ ok: false, reason: 'exchange-failed' });
    expect((await db.doc('salons/f2').get()).get('paymentConnection.status')).toBe('FAILED');
    expect((await db.doc(`${COL.connections}/f2`).get()).exists).toBe(false);
  });

  it('cannot start a second connection while one is active', async () => {
    await expect(initiateConnect(deps(), { salonId: A, uid: 'ownerA' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('2. customer pays the full server-computed amount -> webhook confirms', () => {
  it('hold -> order -> captured webhook -> CONFIRMED', async () => {
    const { h, o } = await paidSetup();
    expect((await booking(h.bookingId)).status).toBe('held');
    expect(o.amount).toBe(50000);
    expect(svc.orders[0]).toMatchObject({ amount: 50000, receipt: `CHAIRLY_${h.bookingId}`, notes: { salonId: A, bookingId: h.bookingId } });
    // Order is created with the connected salon's own token, not any platform credential.
    expect(svc.orders[0].accessToken).toMatch(/^acc_tok_/);

    const r = await hook(paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId }), 'evt_cap_1');
    expect(r).toEqual({ status: 200, outcome: 'confirmed' });
    const b = await booking(h.bookingId);
    expect(b['status']).toBe('confirmed');
    expect(b['payment']).toMatchObject({ status: 'paid', paymentId: 'pay_1', amount: 50000, method: 'upi', orderId: o.orderId });
    expect((await dayBusy())[0].holdUntil).toBeUndefined(); // slot is now permanent
  });

  it('the frontend redirect alone never confirms: before the webhook the booking stays held', async () => {
    const { h } = await paidSetup();
    expect((await booking(h.bookingId)).status).toBe('held');
  });
});

describe('3. payment fails', () => {
  it('booking stays unconfirmed, failure recorded, and the customer can retry with a new order', async () => {
    const { h, o } = await paidSetup();
    expect(await hook(paymentEvent('payment.failed', { orderId: o.orderId, bookingId: h.bookingId }), 'evt_fail_1')).toEqual({ status: 200, outcome: 'payment-failed' });
    const b = await booking(h.bookingId);
    expect(b['status']).toBe('held');
    expect(b['payment']).toMatchObject({ status: 'failed', failureReason: 'BAD_REQUEST_ERROR' });
    const o2 = await createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust1' });
    expect(o2.orderId).not.toBe(o.orderId);
  });
});

describe('4. abandoned payment', () => {
  it('hold expires via the release job and the slot becomes bookable again', async () => {
    const { h } = await paidSetup();
    clock += 31 * 60_000;
    expect(await releaseExpiredHolds(deps())).toBe(1);
    expect((await booking(h.bookingId)).status).toBe('expired');
    expect(await dayBusy()).toHaveLength(0);
    const second = await hold('cust2');
    expect(second.created).toBe(true);
    await expect(createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust1' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('a live hold blocks the slot for everyone else, an expired one does not', async () => {
    await hold('cust1');
    await expect(hold('cust2')).rejects.toMatchObject({ code: 'failed-precondition' });
    clock += 11 * 60_000;
    await expect(hold('cust2')).resolves.toMatchObject({ created: true });
  });

  it('payment captured after the hold was released still confirms when the slot is free', async () => {
    const { h, o } = await paidSetup();
    clock += 31 * 60_000;
    await releaseExpiredHolds(deps());
    expect(await hook(paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId }), 'evt_late')).toEqual({ status: 200, outcome: 'late-confirmed' });
    expect((await booking(h.bookingId)).status).toBe('confirmed');
  });

  it('late payment for a slot someone else took is recorded and flagged for refund, never double-booked', async () => {
    const { h, o } = await paidSetup();
    clock += 31 * 60_000;
    await releaseExpiredHolds(deps());
    const other = await hold('cust2');
    const r = await hook(paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId }), 'evt_late2');
    expect(r.status).toBe(200);
    const b = await booking(h.bookingId);
    expect(b['status']).toBe('expired');
    expect(b['payment']).toMatchObject({ status: 'paid', refundRequired: true });
    expect((await dayBusy()).map((x) => x.bookingId)).toEqual([other.bookingId]);
  });
});

describe('5. duplicate webhook', () => {
  it('is applied once; the redelivery is acknowledged with no further side effects', async () => {
    const { h, o } = await paidSetup();
    const ev = paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId });
    expect((await hook(ev, 'evt_dup')).outcome).toBe('confirmed');
    const first = (await booking(h.bookingId))['confirmedAt'];
    clock += 60_000;
    expect(await hook(ev, 'evt_dup')).toEqual({ status: 200, outcome: 'duplicate' });
    expect((await booking(h.bookingId))['confirmedAt'].toMillis()).toBe(first.toMillis());
    expect((await db.collection(COL.webhookEvents).get()).size).toBe(1);
  });

  it('a redelivery with a new event id is still harmless (already paid)', async () => {
    const { h, o } = await paidSetup();
    const ev = paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId });
    await hook(ev, 'e1');
    expect((await hook(ev, 'e2')).outcome).toBe('ignored');
  });
});

describe('6. OAuth state security', () => {
  it('unknown, expired and reused states are rejected and change nothing', async () => {
    await seedSalon('s6', 'o6');
    expect(await handleCallback(deps(), { code: 'good-code', state: 'nope' })).toEqual({ ok: false, reason: 'invalid-state' });
    expect(await handleCallback(deps(), { code: 'good-code' })).toEqual({ ok: false, reason: 'invalid-state' });

    const expired = new URL((await initiateConnect(deps(), { salonId: 's6', uid: 'o6' })).url).searchParams.get('state')!;
    clock += 11 * 60_000;
    expect(await handleCallback(deps(), { code: 'good-code', state: expired })).toEqual({ ok: false, reason: 'invalid-state' });
    expect((await db.doc('salons/s6').get()).get('paymentConnection.status')).toBe('PENDING');

    clock = T0;
    const ok = new URL((await initiateConnect(deps(), { salonId: 's6', uid: 'o6' })).url).searchParams.get('state')!;
    expect((await handleCallback(deps(), { code: 'good-code', state: ok })).ok).toBe(true);
    // Replaying the same state must not work, and must not touch the salon.
    await disconnect(deps(), 's6');
    expect(await handleCallback(deps(), { code: 'good-code', state: ok })).toEqual({ ok: false, reason: 'invalid-state' });
    expect((await db.doc('salons/s6').get()).get('paymentConnection.status')).toBe('REVOKED');
  });

  it('the salon is taken from the stored state, never from a query parameter', async () => {
    await seedSalon('victim', 'oV');
    const { url } = await initiateConnect(deps(), { salonId: 'ownerOfState', uid: 'x' }).catch(() => ({ url: '' }));
    expect(url).toBe(''); // a salon that does not exist cannot even start a flow
    await seedSalon('mine', 'me');
    const state = new URL((await initiateConnect(deps(), { salonId: 'mine', uid: 'me' })).url).searchParams.get('state')!;
    const r = await handleCallback(deps(), { code: 'good-code', state, ...({ salonId: 'victim' } as object) });
    expect(r).toEqual({ ok: true, salonId: 'mine' });
    expect((await db.doc('salons/victim').get()).get('paymentConnection')).toBeUndefined();
  });
});

describe('7. cross-salon isolation', () => {
  it("salon A's owner cannot act on salon B", async () => {
    const ownerA = { uid: 'ownerA', token: { role: 'owner', salonIds: [A] } };
    await expect(assertSalonOwner(db, ownerA, A)).resolves.toBeUndefined();
    await expect(assertSalonOwner(db, ownerA, B)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(assertSalonOwner(db, { uid: 'random', token: {} }, A)).rejects.toMatchObject({ code: 'permission-denied' });
    // ownerId fallback (before claims refresh) works for the real owner only
    await expect(assertSalonOwner(db, { uid: 'ownerB', token: {} }, B)).resolves.toBeUndefined();
  });

  it("a customer cannot pay for another customer's booking", async () => {
    const h = await hold('cust1');
    await expect(createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust2' })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(svc.orders).toHaveLength(0);
  });

  it('a webhook from another salon\'s account cannot confirm this salon\'s booking', async () => {
    const { h, o } = await paidSetup();
    const r = await hook(paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId, account: 'acc_SOMEONE_ELSE' }), 'evt_x');
    expect(r.outcome).toBe('rejected');
    expect((await booking(h.bookingId)).status).toBe('held');
  });

  it("salon B's connection is not used for salon A's order", async () => {
    await connect(B, 'ownerB');
    const { o } = await paidSetup();
    expect(o.orderId).toBeTruthy();
    const tokenA = (await db.doc(`${COL.connections}/${A}`).get()).get('accessToken');
    expect(svc.orders.at(-1)!.accessToken).toBe(tokenA);
  });
});

describe('8. disconnect', () => {
  it('revokes, deletes tokens, keeps history, and blocks new payments/holds until reconnected', async () => {
    const { h } = await paidSetup();
    await disconnect(deps(), A);
    const salon = (await db.doc(`salons/${A}`).get()).data()!;
    expect(salon['paymentConnection']).toMatchObject({ status: 'REVOKED', razorpayAccountId: null });
    expect((await db.doc(`${COL.connections}/${A}`).get()).exists).toBe(false);
    expect(svc.revoked.length).toBe(2);
    expect((await booking(h.bookingId))['payment'].orderId).toBeTruthy(); // history untouched

    await expect(hold('cust3')).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust1' })).rejects.toMatchObject({ code: 'failed-precondition' });

    await connect(A, 'ownerA');
    await expect(createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust1' })).resolves.toMatchObject({ amount: 50000 });
  });

  it('still disconnects locally when Razorpay revoke fails', async () => {
    svc.failNext = 'revoke';
    await disconnect(deps(), A);
    expect((await db.doc(`${COL.connections}/${A}`).get()).exists).toBe(false);
    expect((await db.doc(`salons/${A}`).get()).get('paymentConnection.status')).toBe('REVOKED');
  });
});

describe('9. manipulated amount', () => {
  it('the order amount always comes from server-side service prices', async () => {
    const h = await hold('cust1', { serviceIds: ['sv1', 'sv2'] });
    // Even if the stored booking price is tampered with, the order uses the catalogue: 500 + 250 = 750 rupees.
    await db.doc(`salons/${A}/bookings/${h.bookingId}`).update({ price: 1 });
    const o = await createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust1', ...({ amount: 100 } as object) });
    expect(o.amount).toBe(75000);
    expect(svc.orders[0].amount).toBe(75000);
    expect((await booking(h.bookingId))['price']).toBe(750);
  });

  it('a webhook whose amount differs from the order is rejected', async () => {
    const { h, o } = await paidSetup();
    const r = await hook(paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId, amount: 100 }), 'evt_amt');
    expect(r.outcome).toBe('rejected');
    expect((await booking(h.bookingId)).status).toBe('held');
  });

  it('a webhook for a different order id is rejected', async () => {
    const { h } = await paidSetup();
    expect((await hook(paymentEvent('payment.captured', { orderId: 'order_OTHER', bookingId: h.bookingId }), 'evt_ord')).outcome).toBe('rejected');
  });
});

describe('10. webhook signature', () => {
  it('invalid signature -> 400 and no state change, no ledger entry', async () => {
    const { h, o } = await paidSetup();
    const ev = paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId });
    const bad = await processWebhook(deps(), { ...signed(ev, 'wrong-secret'), secret: SECRET, eventIdHeader: 'evt_bad' });
    expect(bad).toEqual({ status: 400, outcome: 'invalid-signature' });
    const missing = await processWebhook(deps(), { rawBody: Buffer.from(JSON.stringify(ev)), signature: undefined, secret: SECRET, eventIdHeader: 'evt_bad2' });
    expect(missing.status).toBe(400);
    expect((await booking(h.bookingId)).status).toBe('held');
    expect((await db.collection(COL.webhookEvents).get()).size).toBe(0);
  });

  it('a tampered body fails verification', async () => {
    const { h, o } = await paidSetup();
    const s = signed(paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId }));
    const tampered = Buffer.from(s.rawBody.toString().replace('50000', '1'));
    expect((await processWebhook(deps(), { ...s, rawBody: tampered, eventIdHeader: 'evt_t' })).status).toBe(400);
  });
});

describe('extras', () => {
  it('two customers racing for the same slot: exactly one wins', async () => {
    const results = await Promise.allSettled([hold('cust1'), hold('cust2'), hold('cust3')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await dayBusy())).toHaveLength(1);
  });

  it('createBooking is idempotent for the same request id', async () => {
    const a = await hold('cust1');
    const b = await hold('cust1');
    expect(b.bookingId).toBe(a.bookingId);
    expect(b.created).toBe(false);
    expect((await db.collection(`salons/${A}/bookings`).get()).size).toBe(1);
  });

  it('refreshes an expiring access token once and rotates the refresh token', async () => {
    await db.doc(`${COL.connections}/${A}`).update({ accessExpiresAt: Timestamp.fromMillis(clock + 60_000) });
    const before = (await db.doc(`${COL.connections}/${A}`).get()).get('refreshToken');
    const { o } = await paidSetup();
    expect(o.orderId).toBeTruthy();
    const after = (await db.doc(`${COL.connections}/${A}`).get()).data()!;
    expect(after['refreshToken']).not.toBe(before);
    expect(after['refreshLockUntil']).toBeNull();
    expect(svc.orders[0].accessToken).toBe(after['accessToken']);
  });

  it('order creation failures surface a simple message, not the provider error', async () => {
    const h = await hold('cust1');
    svc.failNext = 'order';
    const err = await createPaymentOrder(deps(), { salonId: A, bookingId: h.bookingId, uid: 'cust1' }).catch((e) => e);
    expect(err.code).toBe('unavailable');
    expect(err.message).toMatch(/temporarily unavailable/i);
    expect(err.message).not.toMatch(/razorpay|500|http/i);
  });

  it('refund webhook updates the payment without rewriting booking history', async () => {
    const { h, o } = await paidSetup();
    await hook(paymentEvent('payment.captured', { orderId: o.orderId, bookingId: h.bookingId }), 'e_cap');
    const refund = { event: 'refund.processed', account_id: 'acc_FAKE00000000001', payload: { payment: { entity: { id: 'pay_1', notes: { salonId: A, bookingId: h.bookingId } } }, refund: { entity: { id: 'rfnd_1', payment_id: 'pay_1', amount: 50000 } } } };
    expect((await hook(refund, 'e_ref')).outcome).toBe('refunded');
    const b = await booking(h.bookingId);
    expect(b['payment']).toMatchObject({ status: 'refunded', refundAmount: 50000 });
    expect(b['status']).toBe('confirmed');
  });
});
