import { Routes } from '@angular/router';
import { canMatchAuthenticated } from './core/guards/can-match-authenticated.guard';
import { isNotAuthenticated } from './core/guards/is-not-authenticated.guard';
import { canMatchAdmin } from './core/guards/can-match-admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/my-requests' },
  {
    path: 'my-requests',
    canMatch: [canMatchAuthenticated],
    loadChildren: () =>
      import('./modules/my-requests/my-requests.routes').then((m) => m.MY_REQUESTS_ROUTES),
  },
  {
    path: 'login',
    canActivate: [isNotAuthenticated],
    loadChildren: () => import('./modules/login/login.routes').then((m) => m.LOGIN_ROUTES),
  },
  {
    path: 'admin',
    canMatch: [canMatchAuthenticated, canMatchAdmin],
    loadChildren: () => import('./modules/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
];
