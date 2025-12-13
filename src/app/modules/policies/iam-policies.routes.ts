import { Routes } from '@angular/router';
import { Policies } from './policies';
import { PoliciesHttp } from './services/policies-http';
import { inject, Injectable } from '@angular/core';
import { AddPolicyRequest } from './models';
import { AddPolicyStrategy } from './add-policy-strategy';

@Injectable()
export class AddIAMPolicyStrategy extends AddPolicyStrategy {
  private readonly policiesHttp = inject(PoliciesHttp);
  addPolicy(request: AddPolicyRequest) {
    return this.policiesHttp.addIAMPolicy(request);
  }
}

export const POLICIES_ROUTES: Routes = [
  {
    path: '',
    component: Policies,
    providers: [{ provide: AddPolicyStrategy, useClass: AddIAMPolicyStrategy }],
    resolve: {
      list: () => {
        const policiesHttp = inject(PoliciesHttp);
        return policiesHttp.getIAMPolicies();
      },
    },
  },
];
