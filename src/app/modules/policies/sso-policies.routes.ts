import { Routes } from '@angular/router';
import { Policies } from './policies';
import { PoliciesHttp } from './services/policies-http';
import { inject, Injectable } from '@angular/core';
import { AddPolicyRequest } from './models';
import { PolicyStrategy } from './policy-strategy';

@Injectable()
export class SSOPolicyStrategy extends PolicyStrategy {
  private readonly policiesHttp = inject(PoliciesHttp);
  type: 'sso' | 'iam' = 'sso';

  addPolicy(request: AddPolicyRequest) {
    return this.policiesHttp.addSSOPolicy(request);
  }

  getPolicies() {
    return this.policiesHttp.getSSOPolicies();
  }
}

export const POLICIES_ROUTES: Routes = [
  {
    path: '',
    component: Policies,
    providers: [{ provide: PolicyStrategy, useClass: SSOPolicyStrategy }],
    resolve: {
      list: () => {
        const policiesHttp = inject(PoliciesHttp);
        return policiesHttp.getSSOPolicies();
      },
    },
  },
];
