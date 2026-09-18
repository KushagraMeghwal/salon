import type { Firestore } from 'firebase-admin/firestore';
import { fail, MESSAGES } from './errors';

export interface CallerAuth {
  uid: string;
  token: { role?: string; salonIds?: string[]; [k: string]: unknown };
}

export function requireAuth(auth: CallerAuth | undefined): CallerAuth {
  if (!auth) fail('unauthenticated', MESSAGES.unauthenticated);
  return auth;
}

/**
 * Same rule as firestore.rules `isOwner(salonId)`: the owner claim for this salon, or the salon's recorded ownerId
 * (covers the moment right after onboarding, before the claim is refreshed).
 */
export async function assertSalonOwner(db: Firestore, auth: CallerAuth, salonId: string): Promise<void> {
  if (auth.token.role === 'owner' && Array.isArray(auth.token.salonIds) && auth.token.salonIds.includes(salonId)) return;
  const snap = await db.doc(`salons/${salonId}`).get();
  if (snap.exists && snap.get('ownerId') === auth.uid) return;
  fail('permission-denied', MESSAGES.forbidden, { reason: 'not-owner', salonId, uid: auth.uid });
}
