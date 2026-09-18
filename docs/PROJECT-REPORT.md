# Chairly: project status report

Multi-salon booking and billing SaaS. Angular 21 (standalone, signals, lazy routes), Tailwind v4, Firebase.
Status: **Phases 1, 2 and 3 done. Phases 4 and 5 pending. The app still runs on mock data.**

## 1. Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Analysis, route map, removals | Done |
| 2 | All Stitch screens as Angular components with mock data | Done (loading skeletons still pending) |
| 3 | Firestore data model, security rules, Storage rules, emulator setup | Done and tested |
| 4 | Cloud Functions business logic, payments stub, subscriptions | **Pending** |
| 5 | Quality: skeletons, empty states, more tests, README | **Pending** |

## 2. Tech and setup

- Angular 21, standalone components, signals, lazy-loaded routes. Tailwind v4 with the Stitch tokens ported to `@theme`.
- `@ngx-translate` v18 for English / Hindi. `qrcode` for QR codes. Firebase SDK v12 installed.
- Firebase project `salon-79da5`. Web config is in `src/environments/environment.ts` (production). `environment.development.ts` points at the **emulators** so local work never touches real data. `FirebaseService` (`src/app/core/firebase/firebase.service.ts`) creates Auth, Firestore and Storage from that file.
- Commands: `npm start`, `npm run build`, `npm test` (17 unit tests), `npm run test:rules` (29 rules tests, needs Java), `npm run emulators`.
- Branding: the salon's own name/logo in headers, "Powered by Chairly" in footers, the Chairly logo only on the splash.

## 3. Pages and features built

### Shared
- **Splash** `/splash`: one Chairly logo with pulse animation, rotating status text, then routes to onboarding or the dashboard.
- Toasts, modals, toggles, day picker, line and donut charts, EN/हिं toggle, salon logo/monogram, top bars, sidebar with mobile drawer.

### Owner panel (desktop-first, tablet-ready)
| Route | Features |
|---|---|
| `/owner/onboarding/salon` | Salon name, logo upload (PNG/JPG, 5 MB), category, phone and email validation, address, "detect my location", live customer-preview card, auto-save, save draft |
| `.../services` | Service catalogue with categories filter, select/deselect, price and duration per service, add custom service, live count and average time |
| `.../timings` | Weekly hours per day, "apply Monday to all", daily break with block-slots option, auto/custom slot mode, buffer, custom intervals, live slot preview generated from your rules |
| `.../staff` | Add/edit/remove stylists, photo, role, services, working days, commission slider |
| `.../done` | Public link, real QR code (download PNG), copy link, WhatsApp/SMS/Facebook share, print standee |
| `/owner/dashboard` | Live earnings, bookings, walk-in vs app, payment split; live queue board (Waiting / In Chair / Done) with Assign/Seat, search, category filter, walk-in modal, rush-hours chart, top stylist |
| `/owner/calendar` | Day matrix per stylist, date navigation, mini calendar, click an empty slot to book, booking details (start, complete, cancel), break blocks, now-line, occupancy, quick-slot finder, conflict checks |
| `/owner/quick-bill` | Service grid, stylist assignment, cart with quantities, coupon and loyalty, 18% GST, Cash/UPI/Card/Split, UPI QR, GST-style invoice number, receipt modal, print, WhatsApp invoice, bill from a queue client |
| `/owner/staff` | Staff table with revenue and commission, detail panel, weekly earnings chart, adjust commission, assign schedule, add staff, export CSV, pay-slip download |
| `/owner/reports` | Day/Week/Month, KPIs, revenue trend with hover tooltip, payment donut, top services (sortable), category margins, insight banner, CSV export, PDF via print |
| `/owner/settings` | Draft, Save, Discard. Tabs: General (Hindi support, holidays add/remove/auto-populate, break and buffer), Policies (pay-at-salon, no-show rule and threshold, cancellation window and fee), Payments (bank account, instant payouts), Subscription (trial countdown, plan) |

### Customer app (mobile-first)
| Route | Features |
|---|---|
| `/s/:slug` | Salon page: open/closed status, call, directions, share, hours, popular services with add, floating cart bar |
| `.../services` | Category tabs, multi-select, running total, duration |
| `.../slot` | 14-day date strip (closed days disabled), morning/afternoon/evening slots from real availability, busy slots shown |
| `.../stylist` | "Any available" or a specific stylist, day timeline, busy stylists with "free at" time |
| `.../pay` | Booking summary, online vs pay-at-salon (blocked by salon setting or no-show rule), simulated payment, confirmation with booking ID, check-in QR, Google Calendar link |
| `/login` | Phone OTP (demo code 123456), 6-box OTP with paste, resend timer, Google button (demo) |
| `/my/bookings` | Upcoming/Past, view pass QR, reschedule sheet (same stylist), cancel with fee shown, book again |

### Stylist app (mobile)
- `/staff/today`: greeting, stats, filters with counts, In-progress / Next up / Later / Completed cards. Start Service, Mark Done, Add-on, Client Delay +10m, all conflict-checked and reflected in the owner calendar.
- `/staff/earnings`: Today/Week/Month net earnings, commission, tips, clients, daily goal, tier, commission log, payout statement CSV.

### Super Admin (built by me in the same design system)
- `/admin/overview`: salons, trials, subscribers, monthly revenue, signup chart, plan mix, trials ending soon.
- `/admin/salons`: search, status filter, view, suspend/reactivate, extend trial.
- `/admin/plans`: three plans, edit price.

## 4. Logic already working (client side, mock data)

- **Availability engine** (`AvailabilityService`): salon hours, holidays (full and half day), breaks, buffer, each stylist's working days and bookings, services each stylist can do, minimum lead time today.
- **Booking rules**: no double booking, no booking in breaks or outside hours, cancel with late fee inside the policy window, reschedule, pay-at-salon and no-show restrictions.
- **Billing**: subtotal, 18% GST, discount, invoice numbers per financial year.
- **Language**: English/Hindi runtime switch for customer and staff main text.

## 5. Backend foundation (Phase 3)

- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, emulator ports, typed schema (`schema.ts`), `docs/data-model.md`.
- Roles via Auth custom claims. Bookings, bills, stats, customers, billing and availability locks are **write-only from Cloud Functions**. Private data (commission, payouts, billing) is split into owner-only documents.
- 25 Firestore and 4 Storage rules tests pass against the emulator.

## 6. Pending

### Phase 4: Cloud Functions (2nd gen, TypeScript)
- `getAvailability`, `createBooking` (transaction), cancel/reschedule, `markNoShow`, Quick Bill with GST invoice numbers.
- Earnings aggregates (day/week/month, per stylist) on booking and bill completion.
- `PaymentProvider` interface and Razorpay stub (order creation, webhook verification), payouts to each salon's own account.
- Subscription: 14-day trial on salon creation, scheduled job to expire trials.
- Onboarding trigger: claim slug, set claims, start trial, activate salon.
- Unit tests for availability and booking logic.
- Add the `functions` block to `firebase.json`.

### Connecting the frontend to Firebase (part of Phase 4)
- Replace the mock `SalonStore`, `AdminStore` and login with Firestore, callable functions and Firebase Auth (Google and real Phone OTP). Add `@angular/fire` if you want its Angular wrappers, or use the existing `FirebaseService`.
- Real role guards (today the guard is a mock that lets the owner open admin and staff).
- Upload logos and photos to Storage instead of storing them in the browser.
- Reports and dashboard KPIs from the aggregates instead of sample numbers.

### Phase 5: quality
- Loading skeletons and empty states everywhere, consistent error toasts, form validation review.
- Tests for functions and more UI flows.
- README with Firebase project setup, environment config, emulator run and deploy commands.

### Missing screens (no Stitch design yet)
- Customer "Stylists" and "Profile" tabs, staff "Clients" and "Profile" tabs.
- Owner Calendar week and month views (buttons show "coming later").
- Notifications, reviews, inventory (removed on purpose), customer list.

## 7. Known gaps and decisions

- Everything runs on mock data stored in the browser. Reports are sample numbers.
- Customer prices are shown GST-inclusive, while Quick Bill adds 18% on top. Needs one decision.
- Stylist and customer photos are initials, not images.
- Owner and admin pages are English only. Customer and staff pages translate headings and buttons, not every sentence.
- Demo logins: OTP `123456`, customer +91 98765 43210, stylist Vikram.
- Google login and the payment step are simulated.
- Tested in Chrome only. Not yet checked on real phones, Safari or Firefox.
- Nothing is committed to git yet (one initial commit exists; all work is uncommitted).
- `firebase.json` still contains a placeholder auth block ("My App", `support@undefined...`).
- Razorpay: paying each salon directly needs Razorpay Route, which requires account approval.
