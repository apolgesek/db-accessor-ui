import { inject } from '@angular/core';
import { CanMatchFn, Router, RedirectCommand } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const canMatchAuthenticated: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isAuthenticated = authService.isAuthenticated;

  if (!isAuthenticated) {
    const path = router.parseUrl('/login');
    return new RedirectCommand(path);
  }

  return isAuthenticated;
};
