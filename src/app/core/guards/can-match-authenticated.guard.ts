import { inject } from '@angular/core';
import { CanMatchFn, Router, RedirectCommand } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SessionCoordinator } from '../services/session-coordinator';

export const canMatchAuthenticated: CanMatchFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isAuthenticated = authService.isAuthenticated;

  if (!isAuthenticated) {
    const path = router.parseUrl('/login');
    return new RedirectCommand(path);
  }

  // Protected routes and their resolvers wait until the backend confirms the browser login session.
  return inject(SessionCoordinator)
    .whenActive()
    .then(() => true);
};
