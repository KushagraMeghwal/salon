import { RAZORPAY } from '../config';
import { RazorpayApiError } from '../lib/errors';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Public key for Razorpay Checkout (`key`). Safe to send to browsers. */
  publicToken: string | null;
  accountId: string | null;
  expiresInSec: number;
  scope: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/**
 * Everything the app needs from Razorpay, behind one interface so the real HTTP calls and the test fake are
 * swappable. The real implementation uses only endpoints documented by Razorpay's OAuth partner docs.
 */
export interface RazorpayConnectService {
  buildAuthorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refresh(refreshToken: string): Promise<Partial<OAuthTokens> & Pick<OAuthTokens, 'accessToken' | 'refreshToken' | 'expiresInSec'>>;
  revoke(token: string, hint: 'access_token' | 'refresh_token'): Promise<void>;
  createOrder(input: { accessToken: string; amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder>;
}

export interface RazorpayOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** TODO(razorpay): confirm with Razorpay whether we onboard in `test` first; the docs default to `live`. */
  mode?: 'test' | 'live';
}

async function call(operation: string, url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(RAZORPAY.REQUEST_TIMEOUT_MS) });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new RazorpayApiError(null, timeout ? 'timeout' : 'network', operation);
  }
  if (!res.ok) throw new RazorpayApiError(res.status, 'http', operation);
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new RazorpayApiError(res.status, 'invalid-response', operation);
  }
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export class HttpRazorpayConnectService implements RazorpayConnectService {
  constructor(private readonly cfg: RazorpayOAuthConfig) {}

  buildAuthorizeUrl(state: string): string {
    const u = new URL(RAZORPAY.AUTHORIZE_URL);
    u.searchParams.set('client_id', this.cfg.clientId);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', this.cfg.redirectUri);
    u.searchParams.set('scope', RAZORPAY.SCOPE);
    u.searchParams.set('state', state);
    return u.toString();
  }

  private mapTokens(j: Record<string, unknown>): OAuthTokens {
    const accessToken = str(j['access_token']);
    const refreshToken = str(j['refresh_token']);
    if (!accessToken || !refreshToken) throw new RazorpayApiError(null, 'invalid-response', 'token');
    return {
      accessToken,
      refreshToken,
      publicToken: str(j['public_token']),
      accountId: str(j['razorpay_account_id']),
      expiresInSec: typeof j['expires_in'] === 'number' ? j['expires_in'] : 90 * 24 * 3600,
      scope: str(j['scope']) ?? RAZORPAY.SCOPE,
    };
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const j = await call('token', RAZORPAY.TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.cfg.redirectUri,
        code,
        ...(this.cfg.mode ? { mode: this.cfg.mode } : {}),
      }),
    });
    return this.mapTokens(j);
  }

  async refresh(refreshToken: string) {
    const j = await call('refresh', RAZORPAY.TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const t = this.mapTokens(j);
    return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresInSec: t.expiresInSec, publicToken: t.publicToken ?? undefined, accountId: t.accountId ?? undefined };
  }

  async revoke(token: string, hint: 'access_token' | 'refresh_token'): Promise<void> {
    await call('revoke', RAZORPAY.REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, token_type_hint: hint, token }),
    });
  }

  async createOrder(input: { accessToken: string; amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
    const j = await call('create-order', `${RAZORPAY.API_BASE}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${input.accessToken}` },
      body: JSON.stringify({ amount: input.amountPaise, currency: 'INR', receipt: input.receipt, notes: input.notes }),
    });
    const id = str(j['id']);
    if (!id) throw new RazorpayApiError(null, 'invalid-response', 'create-order');
    return { id, amount: typeof j['amount'] === 'number' ? j['amount'] : input.amountPaise, currency: str(j['currency']) ?? 'INR' };
  }
}
