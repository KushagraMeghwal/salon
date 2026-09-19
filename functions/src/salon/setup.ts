import { getAuth } from 'firebase-admin/auth';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { fail, MESSAGES } from '../lib/errors';
import type { CallerAuth } from '../lib/auth';
import type { BaseDeps } from '../razorpay/types';
import { DEFAULT_BREAK, DEFAULT_SETTINGS, DEFAULT_TIMINGS, SERVICE_TEMPLATES, TRIAL_DAYS, phoneKey, slugify } from '../../../shared/src';

const DAY_MS = 86_400_000;

export const ownerSalonId = (uid: string) => `sl_${uid}`;

export interface SessionResult {
  role: 'owner' | 'superadmin' | 'staff' | 'customer';
  salonId: string | null;
  status: string | null;
  slug: string | null;
}

async function writeClaims(uid: string, claims: { role: string; salonIds: string[]; staffId?: string }) {
  await getAuth().setCustomUserClaims(uid, claims);
}

async function upsertUser(db: Firestore, auth: CallerAuth, patch: Record<string, unknown>) {
  const ref = db.doc(`users/${auth.uid}`);
  const snap = await ref.get();
  const t = auth.token as Record<string, unknown>;
  await ref.set(
    {
      name: (t['name'] as string) ?? '',
      phone: typeof t['phone_number'] === 'string' ? (t['phone_number'] as string) : '',
      email: (t['email'] as string) ?? '',
      updatedAt: Timestamp.now(),
      ...(snap.exists ? {} : { createdAt: Timestamp.now(), noShowCount: 0 }),
      ...patch,
    },
    { merge: true },
  );
}

/**
 * Owner sign-up / sign-in. First call creates the owner's salon (a draft with the starter catalogue and a 14-day
 * trial) and issues the `owner` claim. Later calls just return it, so it is safe to call on every login.
 * Platform admins (SUPERADMIN_EMAILS, verified email) get the `superadmin` claim instead and no salon.
 */
export async function registerOwner(d: BaseDeps, auth: CallerAuth, superadmins: string[]): Promise<SessionResult> {
  const t = auth.token as Record<string, unknown>;
  const email = typeof t['email'] === 'string' ? (t['email'] as string).toLowerCase() : '';
  if (email && t['email_verified'] === true && superadmins.includes(email)) {
    await writeClaims(auth.uid, { role: 'superadmin', salonIds: [] });
    await upsertUser(d.db, auth, { role: 'superadmin', salonIds: [] });
    return { role: 'superadmin', salonId: null, status: null, slug: null };
  }

  const salonId = ownerSalonId(auth.uid);
  const ref = d.db.doc(`salons/${salonId}`);
  let snap = await ref.get();
  if (!snap.exists) {
    const now = d.now();
    const stamp = Timestamp.fromDate(now);
    const first = typeof t['name'] === 'string' && t['name'] ? (t['name'] as string).split(' ')[0] : '';
    const phone = typeof t['phone_number'] === 'string' ? phoneKey(t['phone_number'] as string) : '';
    const batch = d.db.batch();
    batch.create(ref, {
      ownerId: auth.uid,
      status: 'draft',
      bookable: false,
      slug: '',
      logoUrl: null,
      profile: {
        name: first ? `${first}'s Salon` : 'My Salon', category: 'Unisex', phone, email: email || '', street: '', landmark: '', city: '', pin: '', state: '', lat: 0, lng: 0,
      },
      timings: DEFAULT_TIMINGS,
      breaks: DEFAULT_BREAK,
      holidays: [],
      slotMode: 'auto',
      customSlots: [30, 45, 60],
      buffer: 10,
      settings: DEFAULT_SETTINGS,
      createdAt: stamp,
      updatedAt: stamp,
    });
    SERVICE_TEMPLATES.forEach((s, i) =>
      batch.set(d.db.doc(`salons/${salonId}/services/${s.id}`), {
        name: s.name, category: s.category, description: s.description, price: s.price, duration: s.duration, active: false, custom: false, sortOrder: i, createdAt: stamp, updatedAt: stamp,
      }),
    );
    batch.set(d.db.doc(`salons/${salonId}/private/billing`), {
      plan: 'Trial', status: 'trial', trialEndsAt: Timestamp.fromMillis(now.getTime() + TRIAL_DAYS * DAY_MS),
    });
    await batch.commit();
    snap = await ref.get();
    logger.info('salon created', { salonId });
  }
  const salon = snap.data()!;
  await writeClaims(auth.uid, { role: 'owner', salonIds: [salonId] });
  await upsertUser(d.db, auth, { role: 'owner', salonIds: [salonId] });
  return { role: 'owner', salonId, status: salon['status'], slug: salon['slug'] || null };
}

/** Salon may take bookings while its subscription is active or the trial has not run out. */
async function subscriptionValid(db: Firestore, salonId: string, now: Date): Promise<boolean> {
  const b = (await db.doc(`salons/${salonId}/private/billing`).get()).data();
  if (!b) return false;
  if (b['status'] === 'active') return true;
  return b['status'] === 'trial' && b['trialEndsAt'] && b['trialEndsAt'].toMillis() > now.getTime();
}

/** Finishes onboarding: validates the setup, claims the public slug (unique across all salons) and opens for bookings. */
export async function completeOnboarding(d: BaseDeps, salonId: string): Promise<{ slug: string }> {
  const salonRef = d.db.doc(`salons/${salonId}`);
  const [services, staff] = await Promise.all([
    d.db.collection(`salons/${salonId}/services`).where('active', '==', true).limit(1).get(),
    d.db.collection(`salons/${salonId}/staff`).where('active', '==', true).limit(1).get(),
  ]);
  if (services.empty) fail('failed-precondition', 'Turn on at least one service before you finish.');
  if (staff.empty) fail('failed-precondition', 'Add at least one stylist before you finish.');
  const valid = await subscriptionValid(d.db, salonId, d.now());

  return d.db.runTransaction(async (tx) => {
    const snap = await tx.get(salonRef);
    if (!snap.exists) fail('not-found', MESSAGES.notFound);
    const salon = snap.data()!;
    if (salon['status'] === 'suspended') fail('failed-precondition', 'This salon is suspended. Please contact support.');
    const name = String(salon['profile']?.name ?? '').trim();
    if (name.length < 2) fail('failed-precondition', 'Enter your salon name first.');

    let slug: string = salon['slug'] || '';
    if (!slug) {
      const base = slugify(name);
      for (let i = 0; i < 30 && !slug; i++) {
        const candidate = i === 0 ? base : i < 25 ? `${base}-${i + 1}` : `${base}-${Math.random().toString(36).slice(2, 6)}`;
        const taken = await tx.get(d.db.doc(`slugs/${candidate}`));
        if (!taken.exists || taken.get('salonId') === salonId) slug = candidate;
      }
      if (!slug) fail('aborted', MESSAGES.generic);
      tx.set(d.db.doc(`slugs/${slug}`), { salonId });
    }
    tx.update(salonRef, { slug, status: 'active', bookable: valid, updatedAt: Timestamp.fromDate(d.now()) });
    return { slug };
  });
}

/**
 * A stylist signs in with the phone number the owner saved for them; that unlocks the stylist app for the right salon.
 * Owners and admins keep their own role.
 */
export async function claimStaffAccess(d: BaseDeps, auth: CallerAuth): Promise<{ salonId: string; staffId: string }> {
  const role = auth.token.role;
  if (role === 'owner' || role === 'superadmin') fail('failed-precondition', 'This account is already an owner account.');
  const phone = phoneKey(String((auth.token as Record<string, unknown>)['phone_number'] ?? ''));
  if (!phone) fail('failed-precondition', 'Sign in with the mobile number your salon has on file.');
  const q = await d.db.collectionGroup('staffPrivate').where('phoneKey', '==', phone).limit(5).get();
  const docs = q.docs.filter((x) => x.ref.parent.parent);
  if (!docs.length) fail('not-found', 'We could not find a stylist with this mobile number. Ask your salon owner to add it.');
  const hit = docs[0];
  const salonId = hit.ref.parent.parent!.id;
  const staffSnap = await d.db.doc(`salons/${salonId}/staff/${hit.id}`).get();
  if (!staffSnap.exists || staffSnap.get('active') === false) fail('permission-denied', MESSAGES.forbidden);
  await writeClaims(auth.uid, { role: 'staff', salonIds: [salonId], staffId: hit.id });
  await upsertUser(d.db, auth, { role: 'staff', salonIds: [salonId] });
  return { salonId, staffId: hit.id };
}

export type AdminAction = 'suspend' | 'reactivate' | 'extendTrial' | 'setPlan';

/** Super admin controls. Keeps `status`, `bookable` and the billing document consistent. */
export async function adminSalonAction(
  d: BaseDeps,
  input: { salonId: string; action: AdminAction; days?: number; plan?: string },
): Promise<void> {
  const salonRef = d.db.doc(`salons/${input.salonId}`);
  const billingRef = d.db.doc(`salons/${input.salonId}/private/billing`);
  const now = d.now();
  const stamp = Timestamp.fromDate(now);
  await d.db.runTransaction(async (tx) => {
    const [s, b] = await Promise.all([tx.get(salonRef), tx.get(billingRef)]);
    if (!s.exists) fail('not-found', MESSAGES.notFound);
    const billing = b.data() ?? { plan: 'Trial', status: 'trial', trialEndsAt: stamp };
    const activated = s.get('slug') ? 'active' : 'draft';
    switch (input.action) {
      case 'suspend':
        tx.set(billingRef, { ...billing, status: 'suspended' });
        tx.update(salonRef, { status: 'suspended', bookable: false, updatedAt: stamp });
        break;
      case 'reactivate': {
        const trial = billing['plan'] === 'Trial';
        tx.set(billingRef, { ...billing, status: trial ? 'trial' : 'active' });
        const ok = !trial || (billing['trialEndsAt']?.toMillis?.() ?? 0) > now.getTime();
        tx.update(salonRef, { status: activated, bookable: activated === 'active' && ok, updatedAt: stamp });
        break;
      }
      case 'extendTrial': {
        const days = Math.max(1, Math.min(90, Math.round(input.days ?? 7)));
        const base = Math.max(billing['trialEndsAt']?.toMillis?.() ?? 0, now.getTime());
        tx.set(billingRef, { ...billing, plan: 'Trial', status: 'trial', trialEndsAt: Timestamp.fromMillis(base + days * DAY_MS) });
        tx.update(salonRef, { status: activated, bookable: activated === 'active', updatedAt: stamp });
        break;
      }
      case 'setPlan':
        if (!input.plan) fail('invalid-argument', MESSAGES.badInput);
        tx.set(billingRef, { ...billing, plan: input.plan, status: 'active' });
        tx.update(salonRef, { status: activated, bookable: activated === 'active', updatedAt: stamp });
        break;
    }
  });
}

/** Daily: trials that ran out stop taking bookings until the salon subscribes (or the admin extends). */
export async function expireTrials(d: BaseDeps): Promise<number> {
  const now = d.now();
  const q = await d.db.collectionGroup('private').where('status', '==', 'trial').where('trialEndsAt', '<=', Timestamp.fromDate(now)).limit(400).get();
  let n = 0;
  for (const doc of q.docs) {
    if (doc.id !== 'billing' || !doc.ref.parent.parent) continue;
    const salonRef = doc.ref.parent.parent;
    await doc.ref.update({ status: 'expired' });
    await salonRef.update({ bookable: false, updatedAt: Timestamp.fromDate(now) });
    n++;
  }
  if (n) logger.info('trials expired', { n });
  return n;
}
