import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

/** Simple, user-safe messages. Raw provider errors and internals never reach the client. */
export const MESSAGES = {
  unauthenticated: 'Please sign in to continue.',
  forbidden: 'You do not have access to this salon.',
  notFound: 'We could not find that.',
  badInput: 'Something is wrong with the request. Please check and try again.',
  notConnected: 'Online payment is not available for this salon right now.',
  alreadyConnected: 'Razorpay is already connected. Disconnect it first to connect a different account.',
  slotTaken: 'That time slot was just taken. Please pick another one.',
  holdExpired: 'Your slot hold expired. Please choose a time again.',
  paymentFailed: 'We could not start the payment. Please try again.',
  unavailable: 'Payments are temporarily unavailable. Please try again in a few minutes.',
  generic: 'Something went wrong. Please try again.',
} as const;

export function fail(code: FunctionsErrorCode, message: string, internal?: Record<string, unknown>): never {
  if (internal) logger.warn('request rejected', { code, ...internal });
  throw new HttpsError(code, message);
}

/** Error thrown by the Razorpay client. Carries only the HTTP status, never the response body. */
export class RazorpayApiError extends Error {
  constructor(
    readonly status: number | null,
    readonly kind: 'http' | 'timeout' | 'network' | 'invalid-response',
    readonly operation: string,
  ) {
    super(`razorpay ${operation} failed (${kind}${status ? ' ' + status : ''})`);
  }
}
