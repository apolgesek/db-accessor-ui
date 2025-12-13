import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/iam-policies' },
  {
    path: 'iam-policies',
    loadChildren: () =>
      import('./modules/policies/iam-policies.routes').then((m) => m.POLICIES_ROUTES),
  },
  {
    path: 'sso-policies',
    loadChildren: () =>
      import('./modules/policies/sso-policies.routes').then((m) => m.POLICIES_ROUTES),
  },
];
