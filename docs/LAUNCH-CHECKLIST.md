# Launch checklist

Do every item before real customers or salons use Chairly.

- [ ] **Remove the demo OTP.** The mock phone login accepts `123456` for every number. Delete it in `AuthService` / the login page and switch to Firebase Phone Auth.
- [ ] **Fix the `firebase.json` auth placeholders.** The Auth emulator/config still shows the default app name `My App` and support email `support@undefined.firebaseapp.com`. Set the real project name and a monitored support email in the Firebase console (Authentication > Settings > Public-facing name and support email) and in `firebase.json` where present.
- [ ] **Restrict the Firebase web API key to our domains.** In Google Cloud console > APIs & Services > Credentials, limit the browser key to the production domain(s) (plus `localhost` for development only) and to the Firebase APIs we use. The key is already in the git history of the public repo, so restrict it first.
- [ ] **Enable App Check** (reCAPTCHA Enterprise on web) for Firestore, Storage and Cloud Functions, then switch each to enforced mode once traffic looks healthy.
- [ ] **Test on a real Android phone and a real iPhone** (Chrome and Safari): phone OTP, Google sign-in, booking flow, UPI/online payment, Hindi text rendering, install prompt and the check-in QR.

## Payments (Razorpay)

- [ ] **Encrypt the Razorpay OAuth tokens with KMS.** `razorpayConnections/{salonId}` (server-only) stores `accessToken` and `refreshToken` in plaintext. Add Cloud KMS envelope encryption in `functions/src/razorpay/connect.ts` (encrypt before `set`) and `functions/src/razorpay/tokens.ts` (decrypt on read, re-encrypt on refresh); both carry a `TODO(pre-launch, KMS)` marker, as does `ConnectionDoc` in `types.ts`. Existing plaintext docs need a one-off migration.
- [ ] **Remove the mock bank-details card** ("Payout Accounts & Banking Settlement") from `src/app/features/owner/settings/settings.ts` when the real Firestore/auth wiring replaces the mock stores (`openBank`, `removeBank`, the bank modal, `SalonSettings.bank`). Marked with a TODO in the template.
- [ ] Razorpay OAuth partner app approved, secrets and webhook set up, then `paymentsMode: 'live'` (see `docs/RAZORPAY.md`).
- [ ] **Next payments item: platform plan/subscription fees through Razorpay Subscriptions on Chairly's own account** (separate from customer bookings, which settle to each salon). Not built yet: needs the platform Razorpay keys (`RAZORPAY_PLATFORM_KEY_ID/SECRET`), `createSubscription`, a subscription webhook, and `private/billing` updates. Build once the booking-payment work is stable.

## Messaging

- [ ] **Reminders are wired but send nothing.** `sendReminders` (every 30 minutes) runs behind `ReminderProvider`; the default `NoopReminderProvider` skips every message. Implement a WhatsApp Cloud API provider (Meta templates must be approved first) or an SMS provider in `functions/src/reminders/provider.ts` and return it from `getReminderProvider()` in `functions/src/index.ts`.
