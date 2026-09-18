import { RazorpayApiError } from '../lib/errors';
import type { OAuthTokens, RazorpayConnectService, RazorpayOrder } from './connectService';

/**
 * In-memory Razorpay used by the emulator tests and local development. Never selected in production
 * (see getConnectService): it only activates under the Functions emulator with RAZORPAY_FAKE=1.
 */
export class FakeRazorpayConnectService implements RazorpayConnectService {
  failNext: 'exchange' | 'refresh' | 'order' | 'revoke' | null = null;
  readonly orders: { id: string; amount: number; receipt: string; notes: Record<string, string>; accessToken: string }[] = [];
  readonly revoked: string[] = [];
  private seq = 0;
  accountId = 'acc_FAKE00000000001';

  buildAuthorizeUrl(state: string): string {
    return `https://auth.razorpay.test/authorize?state=${encodeURIComponent(state)}`;
  }

  private maybeFail(op: 'exchange' | 'refresh' | 'order' | 'revoke') {
    if (this.failNext === op) {
      this.failNext = null;
      throw new RazorpayApiError(500, 'http', op);
    }
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    this.maybeFail('exchange');
    if (code === 'bad-code') throw new RazorpayApiError(400, 'http', 'token');
    this.seq++;
    return {
      accessToken: `acc_tok_${this.seq}`,
      refreshToken: `ref_tok_${this.seq}`,
      publicToken: 'rzp_test_oauth_FAKEPUBLIC',
      accountId: this.accountId,
      expiresInSec: 90 * 24 * 3600,
      scope: 'read_write',
    };
  }

  async refresh(refreshToken: string) {
    this.maybeFail('refresh');
    this.seq++;
    return { accessToken: `acc_tok_${this.seq}`, refreshToken: `ref_tok_${this.seq}_from_${refreshToken}`, expiresInSec: 90 * 24 * 3600 };
  }

  async revoke(token: string): Promise<void> {
    this.maybeFail('revoke');
    this.revoked.push(token);
  }

  async createOrder(input: { accessToken: string; amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> {
    this.maybeFail('order');
    const id = `order_FAKE${String(this.orders.length + 1).padStart(6, '0')}`;
    this.orders.push({ id, amount: input.amountPaise, receipt: input.receipt, notes: input.notes, accessToken: input.accessToken });
    return { id, amount: input.amountPaise, currency: 'INR' };
  }
}
