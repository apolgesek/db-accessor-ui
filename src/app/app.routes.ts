import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/policies' },
  {
    path: 'policies',
    loadChildren: () => import('./modules/policies/policies.routes').then((m) => m.POLICIES_ROUTES),
  },
];
