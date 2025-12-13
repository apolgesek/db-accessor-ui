import { Routes } from '@angular/router';
import { Policies } from './policies';
import { PoliciesHttp } from './services/policies-http';
import { inject } from '@angular/core';

export const POLICIES_ROUTES: Routes = [
  {
    path: '',
    component: Policies,
    resolve: {
      list: () => {
        const policiesHttp = inject(PoliciesHttp);
        return policiesHttp.getSSOPolicies();
      },
    },
  },
];
