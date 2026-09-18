# Razorpay merchant connection and customer payments

Each salon connects its **own** Razorpay account through Razorpay's OAuth partner flow. Customer money settles into that salon's account; Chairly never holds it and never sees the salon's API keys.

```
Owner: Connect Razorpay -> initiateRazorpayConnect (callable) -> Razorpay authorize page (KYC/consent on Razorpay)
  -> razorpayOAuthCallback (HTTPS) exchanges the code server-side -> tokens stored in razorpayConnections/{salonId}
  -> salons/{id}.paymentConnection.status = CONNECTED

Customer: createBooking (holds the slot, status "held") -> createPaymentOrder (server-priced order on the salon's account)
  -> Razorpay Checkout (public token as key) -> razorpayWebhook (signature verified) -> booking "confirmed"
```

## Confirmed Razorpay endpoints (from Razorpay's OAuth docs)

| Purpose | Call |
|---|---|
| Authorize | `https://auth.razorpay.com/authorize` (`client_id`, `response_type=code`, `redirect_uri`, `scope`, `state`) |
| Token / refresh | `POST https://auth.razorpay.com/token` (access token 90 days, refresh token 180 days, rotated on refresh) |
| Revoke | `POST https://auth.razorpay.com/revoke` |
| Create order for the salon | `POST https://api.razorpay.com/v1/orders` with `Authorization: Bearer <salon access token>` |
| Checkout | `public_token` from the token response is used as Checkout `key` |

## Still to confirm with Razorpay (marked `TODO(razorpay)` in code)

1. Razorpay must approve Chairly as an OAuth/partner app and issue the client id and secret.
2. The scope granted. The code requests `read_write` (needed to create orders).
3. Whether webhooks for partner-app merchants carry `X-Razorpay-Event-Id` (used as the idempotency key; the body hash is the fallback) and where the webhook is registered (app level vs merchant level).
4. Whether we start in `test` mode (the token request accepts `mode`, default `live`).
5. Auto-capture must be on for the salon accounts. The webhook confirms on `payment.captured`.

## Manual steps in the Razorpay dashboard

1. Create the OAuth application (Partner dashboard). Set the **redirect URI** to the deployed `razorpayOAuthCallback` URL, for example `https://asia-south1-<project>.cloudfunctions.net/razorpayOAuthCallback`.
2. Copy the client id and client secret.
3. Register a webhook pointing at `https://asia-south1-<project>.cloudfunctions.net/razorpayWebhook` with the events `payment.captured`, `payment.failed`, `refund.processed`. Choose a webhook secret.
4. Make sure payment auto-capture is enabled.

## Secrets (Firebase Secret Manager, never in Firestore or the frontend)

```
firebase functions:secrets:set RAZORPAY_OAUTH_CLIENT_ID
firebase functions:secrets:set RAZORPAY_OAUTH_CLIENT_SECRET
firebase functions:secrets:set RAZORPAY_OAUTH_REDIRECT_URI     # the callback function URL above
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

Also set the string param `PUBLIC_BASE_URL` (the frontend origin, for example `https://chairly.app`). `RAZORPAY_PLATFORM_KEY_ID/SECRET` are not used: orders are created with the salon's own OAuth token, not a platform key.

## Data

- `salons/{id}.paymentProvider`, `.paymentConnection {status, razorpayAccountId, oauthConnectedAt, lastVerifiedAt}`. Publicly readable (customers need the status); holds no secrets. Written only by functions; the rules stop owners setting it.
- Server-only (rules deny every client): `razorpayConnections/{salonId}` (tokens), `oauthStates/{sha256(state)}` (single use, 10 min), `webhookEvents/{eventId}` (idempotency ledger).
- `salons/{id}/bookings/{id}`: `status` `held -> confirmed | expired`, `holdExpiresAt`, and `payment {mode, status none|pending|paid|failed|refunded, orderId, paymentId, amount (paise), currency, createdAt, capturedAt, method, failureReason, refundRequired}`.

Note: the paths in the original brief (`private/razorpayConnections/{salonId}`) are not valid Firestore document paths, so these are top-level collections.

## Local testing

```
npm run test:functions   # builds functions, starts the Firestore emulator, runs 30 tests against a fake Razorpay
npm run test:rules       # includes the 6 new rules tests
```

To run the functions emulator by hand: `npm --prefix functions run build`, then `RAZORPAY_FAKE=1 firebase emulators:start --project demo-chairly` (the fake Razorpay is only selected under the Functions emulator). Set `paymentsMode: 'live'` in `src/environments/environment.development.ts` to make the app call the emulated functions (requires the Firebase Auth + Firestore wiring, see below).

## Production checklist

- [ ] Razorpay OAuth app approved; redirect URI and webhook registered; the four secrets set; `PUBLIC_BASE_URL` set.
- [ ] `firebase deploy --only functions,firestore:rules,firestore:indexes` (the indexes create the `status + holdExpiresAt` and `payment.paymentId` collection-group indexes).
- [ ] Set `paymentsMode: 'live'` in `environment.ts` once the app is wired to Firebase Auth and Firestore (Phase 4b).
- [ ] Test a real connect with a test-mode salon, then one Rs 1 payment end to end.
- [ ] Enforce App Check on the callables (see LAUNCH-CHECKLIST).
- [ ] Add an alert on webhook failures (HTTP 400/500 rate) and on `refundRequired` bookings.

## Security summary

- Tokens live only in `razorpayConnections` (rules deny all client access; only the Admin SDK reads it). They are never returned by any function, logged, or put in a redirect URL.
- OAuth `state`: 32 random bytes, stored hashed with salon + uid, expires in 10 minutes, consumed in a transaction (no replay). The callback trusts nothing but the stored binding.
- Every owner callable re-checks ownership (claim or `ownerId`), the same rule as `firestore.rules`. A customer can only pay for their own booking.
- The amount is always computed server-side from the salon's catalogue; a client cannot send one. The webhook also checks order id, amount and Razorpay account id against what we stored.
- The webhook verifies `X-Razorpay-Signature` over the raw body (constant-time), then applies an idempotent ledger. Only a verified webhook can confirm a booking; the browser's "success" callback never does.
- Provider errors never reach the user; logs carry event kinds and ids, never tokens, codes or signatures.
- Not yet done: tokens are stored in plain form in a server-only collection. Encrypt them with a KMS key before launch if you want defence in depth.
