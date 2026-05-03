import { inject } from '@angular/core';
import { CanActivateFn, Router, RedirectCommand } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const isNotAuthenticated: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const isAuthenticated = authService.isAuthenticated;
  if (isAuthenticated) {
    return new RedirectCommand(router.parseUrl('/my-requests'));
  }

  return !isAuthenticated;
};
