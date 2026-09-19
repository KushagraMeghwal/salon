import { defineSecret, defineString } from 'firebase-functions/params';

export const REGION = 'asia-south1';

// ---- Secrets (Secret Manager via defineSecret; never in Firestore or the frontend build) ----
export const RAZORPAY_OAUTH_CLIENT_ID = defineSecret('RAZORPAY_OAUTH_CLIENT_ID');
export const RAZORPAY_OAUTH_CLIENT_SECRET = defineSecret('RAZORPAY_OAUTH_CLIENT_SECRET');
/** Public URL of the razorpayOAuthCallback function; must equal the redirect URI registered in the Razorpay OAuth app. */
export const RAZORPAY_OAUTH_REDIRECT_URI = defineSecret('RAZORPAY_OAUTH_REDIRECT_URI');
export const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

// RAZORPAY_PLATFORM_KEY_ID / RAZORPAY_PLATFORM_KEY_SECRET are intentionally NOT defined: the OAuth flow uses
// per-salon Bearer tokens, and the platform never creates orders on its own account (money goes to the salon).
// They become necessary only for platform-billed subscriptions (createSubscription), which is out of scope here.

/** Where the OAuth callback sends the browser afterwards (frontend origin, no trailing slash). */
export const PUBLIC_BASE_URL = defineString('PUBLIC_BASE_URL', { default: 'http://localhost:4200' });

// ---- Razorpay OAuth (confirmed from https://razorpay.com/docs/partners/technology-partners/onboard-businesses/integrate-oauth/integration-steps/) ----
export const RAZORPAY = {
  AUTHORIZE_URL: 'https://auth.razorpay.com/authorize',
  TOKEN_URL: 'https://auth.razorpay.com/token',
  REVOKE_URL: 'https://auth.razorpay.com/revoke',
  API_BASE: 'https://api.razorpay.com/v1',
  // TODO(razorpay): confirm the scope Razorpay approves for our partner app. `read_write` is needed to create orders.
  SCOPE: 'read_write',
  REQUEST_TIMEOUT_MS: 10_000,
} as const;

export const FRONTEND_SETTINGS_PATH = '/owner/settings';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
/** Refresh the access token when it has less than this left. */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** Refresh tokens live 180 days per Razorpay docs. */
export const REFRESH_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;

/** How long a slot stays held while the customer pays. */
export const HOLD_TTL_MS = 10 * 60 * 1000;
/** Once an order exists the hold is extended so a slow checkout is not cut off. */
export const CHECKOUT_HOLD_TTL_MS = 15 * 60 * 1000;

export const RECEIPT_PREFIX = 'CHAIRLY_';

/** All salon-facing times are IST. */
export const SALON_UTC_OFFSET_MIN = 330;

/** 'true' once Razorpay is live: online bookings are then held until the webhook confirms payment. Until then checkout is simulated. */
export const PAYMENTS_LIVE = defineString('PAYMENTS_LIVE', { default: 'false' });
/** Comma-separated verified emails that become platform super admins on sign-in. */
export const SUPERADMIN_EMAILS = defineString('SUPERADMIN_EMAILS', { default: '' });
