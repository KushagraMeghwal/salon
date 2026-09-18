# Launch checklist

Do every item before real customers or salons use Chairly.

- [ ] **Remove the demo OTP.** The mock phone login accepts `123456` for every number. Delete it in `AuthService` / the login page and switch to Firebase Phone Auth.
- [ ] **Fix the `firebase.json` auth placeholders.** The Auth emulator/config still shows the default app name `My App` and support email `support@undefined.firebaseapp.com`. Set the real project name and a monitored support email in the Firebase console (Authentication > Settings > Public-facing name and support email) and in `firebase.json` where present.
- [ ] **Restrict the Firebase web API key to our domains.** In Google Cloud console > APIs & Services > Credentials, limit the browser key to the production domain(s) (plus `localhost` for development only) and to the Firebase APIs we use. The key is already in the git history of the public repo, so restrict it first.
- [ ] **Enable App Check** (reCAPTCHA Enterprise on web) for Firestore, Storage and Cloud Functions, then switch each to enforced mode once traffic looks healthy.
- [ ] **Test on a real Android phone and a real iPhone** (Chrome and Safari): phone OTP, Google sign-in, booking flow, UPI/online payment, Hindi text rendering, install prompt and the check-in QR.
