import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { z } from 'zod';
import {
  FRONTEND_SETTINGS_PATH,
  PAYMENTS_LIVE,
  PUBLIC_BASE_URL,
  RAZORPAY_OAUTH_CLIENT_ID,
  RAZORPAY_OAUTH_CLIENT_SECRET,
  RAZORPAY_OAUTH_REDIRECT_URI,
  RAZORPAY_WEBHOOK_SECRET,
  REGION,
  SUPERADMIN_EMAILS,
} from './config';
import { assertSalonOwner, requireAuth } from './lib/auth';
import { fail, MESSAGES } from './lib/errors';
import { createBooking as createBookingCore, releaseExpiredHolds } from './bookings/hold';
import { changeBooking as changeBookingCore, getBusy as getBusyCore } from './bookings/manage';
import { createBill as createBillCore } from './billing/bill';
import { adminSalonAction, claimStaffAccess as claimStaffCore, completeOnboarding as completeOnboardingCore, expireTrials, registerOwner as registerOwnerCore } from './salon/setup';
import { disconnect, handleCallback, initiateConnect } from './razorpay/connect';
import { HttpRazorpayConnectService, type RazorpayConnectService } from './razorpay/connectService';
import { FakeRazorpayConnectService } from './razorpay/fakeConnectService';
import { createPaymentOrder as createOrderCore } from './razorpay/payments';
import type { BaseDeps, Deps } from './razorpay/types';
import { processWebhook } from './razorpay/webhook';
import { NoopReminderProvider, type ReminderProvider } from './reminders/provider';
import { sendDueReminders } from './reminders/reminders';

if (!getApps().length) initializeApp();

let fake: FakeRazorpayConnectService | undefined;
/** The fake is only reachable under the Functions emulator with RAZORPAY_FAKE=1; production always uses HTTP. */
function getConnectService(): RazorpayConnectService {
  if (process.env['FUNCTIONS_EMULATOR'] === 'true' && process.env['RAZORPAY_FAKE'] === '1') return (fake ??= new FakeRazorpayConnectService());
  return new HttpRazorpayConnectService({
    clientId: RAZORPAY_OAUTH_CLIENT_ID.value(),
    clientSecret: RAZORPAY_OAUTH_CLIENT_SECRET.value(),
    redirectUri: RAZORPAY_OAUTH_REDIRECT_URI.value(),
  });
}
const deps = (): Deps => ({ db: getFirestore(), svc: getConnectService(), now: () => new Date() });

const OAUTH_SECRETS = [RAZORPAY_OAUTH_CLIENT_ID, RAZORPAY_OAUTH_CLIENT_SECRET, RAZORPAY_OAUTH_REDIRECT_URI];
const callableOpts = { region: REGION, secrets: OAUTH_SECRETS, cors: true } as const;

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) fail('invalid-argument', MESSAGES.badInput, { reason: 'schema' });
  return r.data;
}

const SalonInput = z.object({ salonId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/) });

// ---------- owner: connect / disconnect ----------
export const initiateRazorpayConnect = onCall(callableOpts, async (req) => {
  const auth = requireAuth(req.auth);
  const { salonId } = parse(SalonInput, req.data);
  const d = deps();
  await assertSalonOwner(d.db, auth, salonId);
  return initiateConnect(d, { salonId, uid: auth.uid });
});

export const disconnectRazorpayConnect = onCall(callableOpts, async (req) => {
  const auth = requireAuth(req.auth);
  const { salonId } = parse(SalonInput, req.data);
  const d = deps();
  await assertSalonOwner(d.db, auth, salonId);
  await disconnect(d, salonId);
  return { ok: true };
});

/** Razorpay redirects the owner's browser here. Only `code` and `state` are read; state binds salon + user server-side. */
export const razorpayOAuthCallback = onRequest({ region: REGION, secrets: OAUTH_SECRETS }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  let flag = 'failed';
  try {
    if (req.method === 'GET') {
      const r = await handleCallback(deps(), { code: str(req.query['code']), state: str(req.query['state']), error: str(req.query['error']) });
      flag = r.ok ? 'connected' : 'failed';
    }
  } catch (e) {
    logger.error('razorpay callback error', { kind: e instanceof Error ? e.message : 'unknown' });
  }
  res.redirect(302, `${PUBLIC_BASE_URL.value().replace(/\/$/, '')}${FRONTEND_SETTINGS_PATH}?razorpay=${flag}`);
});

// ---------- customer: hold a slot, then pay ----------
const CreateBookingInput = z.object({
  salonId: SalonInput.shape.salonId,
  requestId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  serviceIds: z.array(z.string().min(1).max(128)).min(1).max(10),
  staffId: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(1439),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().regex(/^\d{10}$/),
  paymentMode: z.enum(['online', 'salon']).default('online'),
});

/**
 * Customer booking. Pay-at-salon confirms immediately. Online payment holds the slot until the Razorpay webhook
 * confirms it (PAYMENTS_LIVE=true); until Razorpay is live, checkout is simulated and the booking confirms at once.
 */
export const createBooking = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  const input = parse(CreateBookingInput, req.data);
  const d: BaseDeps = { db: getFirestore(), now: () => new Date() };
  const hold = input.paymentMode === 'online' && PAYMENTS_LIVE.value() === 'true';
  const r = await createBookingCore(d, { ...input, uid: auth.uid, mode: hold ? 'hold' : 'confirmed', source: 'online' });
  return { bookingId: r.bookingId, holdExpiresAt: r.holdExpiresAt.toISOString(), staffId: r.staffId, price: r.price, bookingNo: r.bookingNo, status: r.status };
});

// ---------- owner: bookings, billing ----------
const OwnerBookingInput = z.object({
  salonId: SalonInput.shape.salonId,
  requestId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  serviceIds: z.array(z.string().min(1).max(128)).min(1).max(10),
  staffId: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(1439),
  customerName: z.string().trim().min(1).max(80),
  customerPhone: z.string().regex(/^(\d{10})?$/),
  notes: z.string().trim().max(300).optional(),
  duration: z.number().int().min(5).max(480).optional(),
});

export const createOwnerBooking = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  const input = parse(OwnerBookingInput, req.data);
  const d: BaseDeps = { db: getFirestore(), now: () => new Date() };
  await assertSalonOwner(d.db, auth, input.salonId);
  const r = await createBookingCore(d, {
    ...input, uid: auth.uid, customerId: null, mode: 'confirmed', source: 'owner', paymentMode: 'salon', durationOverride: input.duration,
  });
  return { bookingId: r.bookingId, staffId: r.staffId, bookingNo: r.bookingNo };
});

const ChangeBookingInput = z.object({
  salonId: SalonInput.shape.salonId,
  bookingId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  action: z.enum(['cancel', 'reschedule', 'start', 'complete', 'no-show', 'delay', 'addon']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start: z.number().int().min(0).max(1439).optional(),
  minutes: z.number().int().min(1).max(240).optional(),
  serviceId: z.string().min(1).max(128).optional(),
});

/** Cancel, reschedule, start, complete, no-show, delay, add-on. Who may do what is decided inside. */
export const changeBooking = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  const input = parse(ChangeBookingInput, req.data);
  return changeBookingCore({ db: getFirestore(), now: () => new Date() }, auth, input);
});

const BusyInput = z.object({ salonId: SalonInput.shape.salonId, from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), days: z.number().int().min(1).max(31).default(21) });

/** Public: which stretches of each stylist's day are already taken (no customer details). */
export const getBusy = onCall({ region: REGION, cors: true }, async (req) => {
  const input = parse(BusyInput, req.data);
  return { busy: await getBusyCore({ db: getFirestore(), now: () => new Date() }, input.salonId, input.from, input.days) };
});

const BillInput = z.object({
  salonId: SalonInput.shape.salonId,
  client: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(20).default(''),
  lines: z
    .array(z.object({ serviceId: z.string().min(1).max(160), name: z.string().min(1).max(160), price: z.number().min(0).max(1_000_000), qty: z.number().int().min(1).max(50), staffId: z.string().max(128) }))
    .min(1)
    .max(60),
  discount: z.number().min(0).max(10_000_000).default(0),
  couponCode: z.string().max(40).optional(),
  method: z.enum(['Cash', 'UPI', 'Card', 'Split']),
  queueId: z.string().max(128).nullish(),
  bookingId: z.string().max(64).nullish(),
});

export const createBill = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  const input = parse(BillInput, req.data);
  const d: BaseDeps = { db: getFirestore(), now: () => new Date() };
  await assertSalonOwner(d.db, auth, input.salonId);
  return createBillCore(d, { ...input, queueId: input.queueId ?? null, bookingId: input.bookingId ?? null });
});

// ---------- sign-in: roles ----------
export const registerOwner = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  const admins = SUPERADMIN_EMAILS.value().split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return registerOwnerCore({ db: getFirestore(), now: () => new Date() }, auth, admins);
});

export const completeOnboarding = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  const { salonId } = parse(SalonInput, req.data);
  const d: BaseDeps = { db: getFirestore(), now: () => new Date() };
  await assertSalonOwner(d.db, auth, salonId);
  return completeOnboardingCore(d, salonId);
});

export const claimStaffAccess = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  return claimStaffCore({ db: getFirestore(), now: () => new Date() }, auth);
});

const AdminInput = z.object({
  salonId: SalonInput.shape.salonId,
  action: z.enum(['suspend', 'reactivate', 'extendTrial', 'setPlan']),
  days: z.number().int().min(1).max(90).optional(),
  plan: z.string().max(40).optional(),
});

/** Super admin only: suspend / reactivate a salon, extend its trial, set its plan. */
export const adminAction = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  if (auth.token.role !== 'superadmin') fail('permission-denied', MESSAGES.forbidden);
  await adminSalonAction({ db: getFirestore(), now: () => new Date() }, parse(AdminInput, req.data));
  return { ok: true };
});

const PaymentOrderInput = z.object({ salonId: SalonInput.shape.salonId, bookingId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/) });

export const createPaymentOrder = onCall(callableOpts, async (req) => {
  const auth = requireAuth(req.auth);
  const input = parse(PaymentOrderInput, req.data);
  const r = await createOrderCore(deps(), { ...input, uid: auth.uid });
  return { bookingId: r.bookingId, orderId: r.orderId, amount: r.amount, currency: r.currency, keyId: r.keyId };
});

// ---------- Razorpay -> us ----------
export const razorpayWebhook = onRequest({ region: REGION, secrets: [RAZORPAY_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  const header = (n: string) => (typeof req.headers[n] === 'string' ? (req.headers[n] as string) : undefined);
  const result = await processWebhook(
    { db: getFirestore(), now: () => new Date() },
    { rawBody: req.rawBody, signature: header('x-razorpay-signature'), eventIdHeader: header('x-razorpay-event-id'), secret: RAZORPAY_WEBHOOK_SECRET.value() },
  );
  res.status(result.status).json({ ok: result.status === 200 });
});

// ---------- housekeeping ----------
export const releaseUnpaidHolds = onSchedule({ region: REGION, schedule: 'every 5 minutes' }, async () => {
  await releaseExpiredHolds({ db: getFirestore(), now: () => new Date() });
});

/** Trials that ran out stop taking bookings until the salon subscribes (or the admin extends the trial). */
export const endExpiredTrials = onSchedule({ region: REGION, schedule: 'every day 03:00', timeZone: 'Asia/Kolkata' }, async () => {
  await expireTrials({ db: getFirestore(), now: () => new Date() });
});

/** Reminder channel. TODO(whatsapp): return the WhatsApp Cloud API provider here once Meta templates are approved. */
function getReminderProvider(): ReminderProvider {
  return new NoopReminderProvider();
}

export const sendReminders = onSchedule({ region: REGION, schedule: 'every 30 minutes' }, async () => {
  await sendDueReminders({ db: getFirestore(), now: () => new Date() }, getReminderProvider());
});
