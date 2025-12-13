import { Routes } from '@angular/router';
import { Policies } from './policies';
import { PoliciesHttp } from './services/policies-http';
import { inject, Injectable } from '@angular/core';
import { AddPolicyRequest } from './models';
import { AddPolicyStrategy } from './add-policy-strategy';

@Injectable()
export class AddSSOPolicyStrategy extends AddPolicyStrategy {
  private readonly policiesHttp = inject(PoliciesHttp);
  addPolicy(request: AddPolicyRequest) {
    return this.policiesHttp.addSSOPolicy(request);
  }
}

export const POLICIES_ROUTES: Routes = [
  {
    path: '',
    component: Policies,
    providers: [{ provide: AddPolicyStrategy, useClass: AddSSOPolicyStrategy }],
    resolve: {
      list: () => {
        const policiesHttp = inject(PoliciesHttp);
        return policiesHttp.getSSOPolicies();
      },
    },
  },
];
