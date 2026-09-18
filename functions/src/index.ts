import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { z } from 'zod';
import {
  FRONTEND_SETTINGS_PATH,
  PUBLIC_BASE_URL,
  RAZORPAY_OAUTH_CLIENT_ID,
  RAZORPAY_OAUTH_CLIENT_SECRET,
  RAZORPAY_OAUTH_REDIRECT_URI,
  RAZORPAY_WEBHOOK_SECRET,
  REGION,
} from './config';
import { assertSalonOwner, requireAuth } from './lib/auth';
import { fail, MESSAGES } from './lib/errors';
import { createHeldBooking, releaseExpiredHolds } from './bookings/hold';
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
});

export const createBooking = onCall({ region: REGION, cors: true }, async (req) => {
  const auth = requireAuth(req.auth);
  const input = parse(CreateBookingInput, req.data);
  const d: BaseDeps = { db: getFirestore(), now: () => new Date() };
  const r = await createHeldBooking(d, { ...input, uid: auth.uid });
  return { bookingId: r.bookingId, holdExpiresAt: r.holdExpiresAt.toISOString(), staffId: r.staffId, price: r.price };
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

/** Reminder channel. TODO(whatsapp): return the WhatsApp Cloud API provider here once Meta templates are approved. */
function getReminderProvider(): ReminderProvider {
  return new NoopReminderProvider();
}

export const sendReminders = onSchedule({ region: REGION, schedule: 'every 30 minutes' }, async () => {
  await sendDueReminders({ db: getFirestore(), now: () => new Date() }, getReminderProvider());
});
