import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models';
import { AuthService } from '../services/auth.service';
import { SalonStore } from '../services/salon.store';

/** Where someone who is not signed in (or has the wrong role) is sent for each area. */
const LOGIN: Record<string, string> = { owner: '/', superadmin: '/', staff: '/staff/login' };

/**
 * Real role check from the Firebase token claims. Owner and staff routes also load that salon's data before
 * the page renders, so every screen starts with real state, never a flash of empty data.
 */
export const roleGuard =
  (...allowed: Role[]): CanActivateFn =>
  async (_route, state) => {
    // inject() only works before the first await.
    const auth = inject(AuthService);
    const router = inject(Router);
    const store = inject(SalonStore);
    await auth.ready;
    const loginPath = LOGIN[allowed[0]] ?? '/';
    if (!auth.user()) return router.createUrlTree([loginPath], { queryParams: { returnUrl: state.url } });
    if (!allowed.includes(auth.role())) return router.createUrlTree([auth.role() === 'customer' ? loginPath : homeFor(auth.role())]);

    const salonId = auth.salonId();
    try {
      if (auth.role() === 'owner' && salonId) await store.loadOwner(salonId);
      if (auth.role() === 'staff' && salonId) await store.loadStaff(salonId, auth.staffId());
    } catch {
      return router.createUrlTree([loginPath]);
    }
    return true;
  };

export function homeFor(role: Role): string {
  return role === 'superadmin' ? '/admin' : role === 'staff' ? '/staff' : role === 'owner' ? '/splash' : '/';
}
