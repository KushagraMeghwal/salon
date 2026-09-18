import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Razorpay signs the raw request body with HMAC-SHA256 (hex) using the webhook secret. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
