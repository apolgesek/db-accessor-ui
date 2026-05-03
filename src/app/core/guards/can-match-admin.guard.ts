import { inject } from '@angular/core';
import { CanMatchFn, Router, RedirectCommand } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const canMatchAdmin: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isAdmin = authService.isAdmin();
  if (!isAdmin) {
    const path = router.parseUrl('/my-requests');
    return new RedirectCommand(path);
  }

  return isAdmin;
};
