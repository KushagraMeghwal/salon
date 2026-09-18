import { logger } from 'firebase-functions';
import { Timestamp } from 'firebase-admin/firestore';
import { REFRESH_TOKEN_TTL_MS, TOKEN_REFRESH_MARGIN_MS } from '../config';
import { fail, MESSAGES } from '../lib/errors';
import { COL, salonRef, type ConnectionDoc, type Deps } from './types';

const LOCK_MS = 30_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns a usable access token for the salon, refreshing it when it is about to expire.
 * Razorpay rotates the refresh token on every refresh, so concurrent refreshes would invalidate each other:
 * a short Firestore lease makes sure only one caller refreshes while the others wait and re-read.
 */
export async function getValidAccessToken(d: Deps, salonId: string): Promise<{ accessToken: string; publicToken: string | null }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const ref = d.db.doc(`${COL.connections}/${salonId}`);
    const now = d.now().getTime();

    const step = await d.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { kind: 'missing' as const };
      const c = snap.data() as ConnectionDoc;
      if (c.accessExpiresAt.toMillis() - TOKEN_REFRESH_MARGIN_MS > now) return { kind: 'ok' as const, c };
      if (c.refreshLockUntil && c.refreshLockUntil.toMillis() > now) return { kind: 'wait' as const };
      tx.update(ref, { refreshLockUntil: Timestamp.fromMillis(now + LOCK_MS) });
      return { kind: 'refresh' as const, c };
    });

    if (step.kind === 'missing') fail('failed-precondition', MESSAGES.notConnected, { reason: 'no-connection', salonId });
    if (step.kind === 'ok') return { accessToken: step.c.accessToken, publicToken: step.c.publicToken };
    if (step.kind === 'wait') {
      await sleep(500);
      continue;
    }

    try {
      // TODO(pre-launch, KMS): step.c.* are read in plaintext here and rewritten below; decrypt on read and re-encrypt on write
      // together with connect.ts (same key), or refresh will corrupt encrypted tokens.
      const r = await d.svc.refresh(step.c.refreshToken);
      const stamp = Timestamp.fromDate(d.now());
      await ref.update({
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        ...(r.publicToken ? { publicToken: r.publicToken } : {}),
        accessExpiresAt: Timestamp.fromMillis(now + r.expiresInSec * 1000),
        refreshExpiresAt: Timestamp.fromMillis(now + REFRESH_TOKEN_TTL_MS),
        refreshLockUntil: null,
        updatedAt: stamp,
      });
      await salonRef(d, salonId).update({ 'paymentConnection.lastVerifiedAt': stamp });
      return { accessToken: r.accessToken, publicToken: r.publicToken ?? step.c.publicToken };
    } catch (e) {
      await ref.update({ refreshLockUntil: null });
      logger.warn('razorpay token refresh failed', { salonId, kind: e instanceof Error ? e.message : 'unknown' });
      // A refresh token that no longer works means the salon must reconnect.
      if (e instanceof Error && /http 4\d\d/.test(e.message)) {
        await ref.delete();
        await salonRef(d, salonId).update({ 'paymentConnection.status': 'REVOKED', 'paymentConnection.razorpayAccountId': null });
        fail('failed-precondition', MESSAGES.notConnected, { reason: 'refresh-rejected', salonId });
      }
      fail('unavailable', MESSAGES.unavailable);
    }
  }
  fail('unavailable', MESSAGES.unavailable, { reason: 'refresh-lock-timeout', salonId });
}
