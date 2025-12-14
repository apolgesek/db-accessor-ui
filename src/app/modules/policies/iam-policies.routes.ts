import { Routes } from '@angular/router';
import { Policies } from './policies';
import { PoliciesHttp } from './services/policies-http';
import { inject, Injectable } from '@angular/core';
import { AddPolicyRequest } from './models';
import { PolicyStrategy } from './policy-strategy';

@Injectable()
export class IAMPolicyStrategy extends PolicyStrategy {
  private readonly policiesHttp = inject(PoliciesHttp);

  addPolicy(request: AddPolicyRequest) {
    return this.policiesHttp.addIAMPolicy(request);
  }

  getPolicies() {
    return this.policiesHttp.getIAMPolicies();
  }
}

export const POLICIES_ROUTES: Routes = [
  {
    path: '',
    component: Policies,
    providers: [{ provide: PolicyStrategy, useClass: IAMPolicyStrategy }],
    resolve: {
      list: () => {
        const policiesHttp = inject(PoliciesHttp);
        return policiesHttp.getIAMPolicies();
      },
    },
  },
];
