import type { Firestore, Timestamp } from 'firebase-admin/firestore';
import type { RazorpayConnectService } from './connectService';

export interface BaseDeps {
  db: Firestore;
  now: () => Date;
}

export interface Deps extends BaseDeps {
  svc: RazorpayConnectService;
}

export type ConnectionStatus = 'NOT_CONNECTED' | 'PENDING' | 'CONNECTED' | 'REVOKED' | 'FAILED';

/** Field on salons/{salonId}. Readable by anyone who can read the salon doc, so it holds NO secrets. */
export interface PaymentConnection {
  status: ConnectionStatus;
  razorpayAccountId: string | null;
  oauthConnectedAt: Timestamp | null;
  lastVerifiedAt: Timestamp | null;
}

// Server-only collections (firestore.rules deny every client read/write; only the Admin SDK touches them).
export const COL = {
  connections: 'razorpayConnections', // {salonId} -> tokens
  oauthStates: 'oauthStates', // {sha256(state)} -> single-use binding
  webhookEvents: 'webhookEvents', // {eventId} -> idempotency ledger
} as const;

// TODO(pre-launch, KMS): accessToken / refreshToken are plaintext in this server-only doc. Encrypt them (see connect.ts and tokens.ts).
export interface ConnectionDoc {
  accessToken: string;
  refreshToken: string;
  publicToken: string | null;
  scope: string;
  accessExpiresAt: Timestamp;
  refreshExpiresAt: Timestamp;
  refreshLockUntil?: Timestamp | null;
  updatedAt: Timestamp;
}

export const salonRef = (d: BaseDeps, salonId: string) => d.db.doc(`salons/${salonId}`);
