import { randomBytes } from 'node:crypto';
import { logger } from 'firebase-functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { OAUTH_STATE_TTL_MS, REFRESH_TOKEN_TTL_MS } from '../config';
import { fail, MESSAGES } from '../lib/errors';
import { sha256 } from '../lib/signature';
import { COL, salonRef, type ConnectionDoc, type Deps } from './types';

export type CallbackResult = { ok: true; salonId: string } | { ok: false; reason: 'denied' | 'invalid-state' | 'exchange-failed'; salonId?: string };

/** Step 1: called by the owner (ownership already verified by the wrapper). Returns the Razorpay authorization URL. */
export async function initiateConnect(d: Deps, input: { salonId: string; uid: string }): Promise<{ url: string }> {
  const salon = await salonRef(d, input.salonId).get();
  if (!salon.exists) fail('not-found', MESSAGES.notFound);
  if (salon.get('paymentConnection.status') === 'CONNECTED') fail('failed-precondition', MESSAGES.alreadyConnected);

  const state = randomBytes(32).toString('base64url');
  const now = d.now();
  await d.db.doc(`${COL.oauthStates}/${sha256(state)}`).set({
    salonId: input.salonId,
    uid: input.uid,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromMillis(now.getTime() + OAUTH_STATE_TTL_MS),
    used: false,
  });
  await salonRef(d, input.salonId).set(
    { paymentProvider: 'razorpay', paymentConnection: { status: 'PENDING', razorpayAccountId: null, oauthConnectedAt: null, lastVerifiedAt: null } },
    { merge: true },
  );
  logger.info('razorpay connect initiated', { salonId: input.salonId });
  return { url: d.svc.buildAuthorizeUrl(state) };
}

async function markFailed(d: Deps, salonId: string) {
  await d.db.doc(`${COL.connections}/${salonId}`).delete();
  await salonRef(d, salonId).set(
    { paymentConnection: { status: 'FAILED', razorpayAccountId: null, oauthConnectedAt: null, lastVerifiedAt: null } },
    { merge: true },
  );
}

/**
 * Step 2: the browser returns from Razorpay. The ONLY trusted salon/user binding is what we stored against `state`;
 * nothing else in the query string is used.
 */
export async function handleCallback(d: Deps, q: { code?: string; state?: string; error?: string }): Promise<CallbackResult> {
  if (!q.state) return { ok: false, reason: 'invalid-state' };
  const ref = d.db.doc(`${COL.oauthStates}/${sha256(q.state)}`);
  const now = d.now();

  // Consume the state atomically: missing, expired or already-used states are rejected and can never be replayed.
  const salonId = await d.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const s = snap.data() as { salonId: string; used: boolean; expiresAt: Timestamp };
    if (s.used || s.expiresAt.toMillis() <= now.getTime()) return null;
    tx.update(ref, { used: true, usedAt: Timestamp.fromDate(now) });
    return s.salonId;
  });
  if (!salonId) return { ok: false, reason: 'invalid-state' };

  if (q.error || !q.code) {
    await markFailed(d, salonId);
    await ref.delete();
    logger.info('razorpay connect denied', { salonId });
    return { ok: false, reason: 'denied', salonId };
  }

  try {
    const t = await d.svc.exchangeCode(q.code);
    if (!t.accountId) throw new Error('missing account id');
    const stamp = Timestamp.fromDate(now);
    const conn: ConnectionDoc = {
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      publicToken: t.publicToken,
      scope: t.scope,
      accessExpiresAt: Timestamp.fromMillis(now.getTime() + t.expiresInSec * 1000),
      refreshExpiresAt: Timestamp.fromMillis(now.getTime() + REFRESH_TOKEN_TTL_MS),
      updatedAt: stamp,
    };
    await d.db.doc(`${COL.connections}/${salonId}`).set(conn);
    await salonRef(d, salonId).set(
      { paymentProvider: 'razorpay', paymentConnection: { status: 'CONNECTED', razorpayAccountId: t.accountId, oauthConnectedAt: stamp, lastVerifiedAt: stamp } },
      { merge: true },
    );
    await ref.delete();
    logger.info('razorpay connected', { salonId });
    return { ok: true, salonId };
  } catch (e) {
    // Log the failure kind only; never the code, tokens or provider body.
    logger.warn('razorpay code exchange failed', { salonId, kind: e instanceof Error ? e.message : 'unknown' });
    await markFailed(d, salonId);
    await ref.delete();
    return { ok: false, reason: 'exchange-failed', salonId };
  }
}

/** Revokes at Razorpay when possible, always deletes local tokens, keeps payment history untouched. */
export async function disconnect(d: Deps, salonId: string): Promise<void> {
  const ref = d.db.doc(`${COL.connections}/${salonId}`);
  const snap = await ref.get();
  if (snap.exists) {
    const c = snap.data() as ConnectionDoc;
    // Best effort: a failed revoke must not leave the salon connected locally.
    for (const [token, hint] of [[c.accessToken, 'access_token'], [c.refreshToken, 'refresh_token']] as const) {
      try {
        await d.svc.revoke(token, hint);
      } catch (e) {
        logger.warn('razorpay revoke failed', { salonId, hint, kind: e instanceof Error ? e.message : 'unknown' });
      }
    }
    await ref.delete();
  }
  await salonRef(d, salonId).set(
    { paymentConnection: { status: 'REVOKED', razorpayAccountId: null, oauthConnectedAt: null, lastVerifiedAt: FieldValue.serverTimestamp() } },
    { merge: true },
  );
  logger.info('razorpay disconnected', { salonId });
}
