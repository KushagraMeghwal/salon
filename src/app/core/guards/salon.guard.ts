import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SalonStore } from '../services/salon.store';

/** Resolves /s/:slug to a salon before any customer page renders. Unknown or unpublished salons show a friendly page. */
export const salonGuard: CanActivateFn = async (route) => {
  const store = inject(SalonStore);
  const router = inject(Router);
  const slug = (route.paramMap.get('slug') ?? '').toLowerCase();
  try {
    return (await store.loadPublic(slug)) ? true : router.createUrlTree(['/not-found']);
  } catch {
    return router.createUrlTree(['/not-found'], { queryParams: { reason: 'offline' } });
  }
};
