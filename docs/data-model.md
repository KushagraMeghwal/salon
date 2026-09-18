# Chairly data model and access rules

Types: `src/app/core/firebase/schema.ts`. Rules: `firestore.rules`, `storage.rules`. Tests: `npm run test:rules` (needs Java).

## Roles

Roles come from **Auth custom claims**, set only by Cloud Functions: `role` (`customer | staff | owner | superadmin`), `salonIds`, and `staffId` for stylists. `users/{uid}.role` mirrors it for display. A signed-in user with no claim is a customer.

## Collections

| Path | Purpose | Read | Write |
|---|---|---|---|
| `users/{uid}` | profile, role mirror, `noShowCount` | self, superadmin | self may edit `name/phone/lang` only; create as customer |
| `slugs/{slug}` | public link `/s/:slug` -> `salonId` | anyone (get only) | functions |
| `plans/{id}` | subscription plans | anyone | superadmin |
| `platform/stats` | admin overview | superadmin | functions |
| `salons/{id}` | profile, slug, timings, breaks, holidays, slotMode, customSlots, policy settings | anyone (get); owner/superadmin can list their own | owner (not `status/slug/ownerId/bookable`), superadmin |
| `salons/{id}/services/{id}` | catalogue | anyone | owner (validated) |
| `salons/{id}/staff/{id}` | public stylist card, services, working days | anyone | owner (validated) |
| `salons/{id}/staffPrivate/{id}` | phone, email, **commission %** | owner, that stylist | owner |
| `salons/{id}/staffStats/{id}` | clients, revenue, commission, tips | owner, that stylist | functions |
| `salons/{id}/stats/{key}` | day/week/month earnings aggregates | owner | functions |
| `salons/{id}/bookings/{id}` | appointments | owner; assigned stylist; the booking's customer | **functions only** |
| `salons/{id}/bills/{id}` | GST invoices | owner | **functions only** |
| `salons/{id}/customers/{uid}` | per-salon visits and `noShowCount` | owner; the customer (own) | functions |
| `salons/{id}/private/payout` | masked bank details | owner | owner |
| `salons/{id}/private/billing` | plan, trial, status | owner, superadmin | functions, superadmin |
| `salons/{id}/staffDays/{staff_date}` | locks used by the booking transaction | nobody | functions |

Customers list their own bookings across salons with a collection-group query on `bookings` where `customerId == uid`.

## Why it is shaped this way

- **Firestore has no field-level rules**, so anything private (commission, payouts, billing, customers) lives in its own document or subcollection instead of inside a public one.
- **Money and booking state are never written by clients.** Callable functions run the booking in a transaction (no double booking), enforce the pay-at-salon and no-show rules, issue invoices and update aggregates.
- **Public browsing without login** (salon page, services, stylists) works, but salons cannot be listed or scraped.
- **Owners cannot change** `status`, `slug`, `ownerId` or `bookable`. Suspending a salon or ending a trial is a superadmin/function action.
- **Onboarding:** a signed-in user creates `salons/{id}` with `status: 'draft'` and their own `ownerId`. A function then claims the slug, sets the `owner` claim, starts the 14-day trial and flips the salon to `active`.
