# Deploy Chairly (project salon-79da5)

## One-time console steps (cannot be done from the CLI)
1. Authentication > Sign-in method: enable **Google**, **Email/Password**, and **Phone** (Phone needs the Blaze plan; add `salon-79da5.web.app` to authorised domains).
2. `functions/.env.salon-79da5` holds `SUPERADMIN_EMAILS` (verified emails that become platform admin on sign-in) and `PAYMENTS_LIVE=false` (keep false until Razorpay is live; online payment is simulated while false).

## Deploy
```
npm run build
npm run test:rules && npm run test:functions && npm test
FUNCTIONS_DISCOVERY_TIMEOUT=120 npx firebase deploy --only firestore,functions,hosting --project salon-79da5
```
`firebase.json` also declares the Google provider (`auth` block): `npx firebase deploy --only auth` applies it.

## Roles
- Owner: `/` (sign in with Google, mobile OTP or email) creates the owner's salon on first login.
- Stylist: `/staff/login` (mobile number the owner saved for them).
- Customer: `/s/<slug>` then sign in with Google or mobile OTP.
- Platform admin: sign in at `/` with an email listed in `SUPERADMIN_EMAILS`, then `/admin`.
