import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models';
import { AuthService } from '../services/auth.service';

export const roleGuard =
  (...allowed: Role[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    return allowed.includes(auth.role()) ? true : inject(Router).createUrlTree(['/splash']);
  };
