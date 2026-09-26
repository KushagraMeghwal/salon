import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SalonStore } from '../services/salon.store';

/**
 * Start page of the installed app (manifest start_url). One app icon serves every audience, so it sends
 * each person to their own home: owners to the dashboard, stylists to today, customers back to their salon.
 */
export const launchGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const store = inject(SalonStore);
  await auth.ready;
  const role = auth.user() ? auth.role() : null;
  if (role === 'owner') return router.createUrlTree(['/owner/dashboard']);
  if (role === 'superadmin') return router.createUrlTree(['/admin']);
  if (role === 'staff') return router.createUrlTree(['/staff/today']);
  const slug = store.lastSlug();
  if (slug) return router.createUrlTree(['/s', slug]);
  return router.createUrlTree([role === 'customer' ? '/my/bookings' : '/']);
};
