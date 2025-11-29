import { inject, Injectable } from '@angular/core';
import { AddPolicyRequest } from '../models';
import { HttpClient } from '@angular/common/http';
import { BASE_URL } from '../../../core';

export type PolicyResponse = {
  policyName: string;
  policyId: string;
  creationDate: string;
  expiresAt: number;
};

@Injectable({
  providedIn: 'root',
})
export class PoliciesHttp {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BASE_URL);

  addPolicy(request: AddPolicyRequest) {
    return this.http.post(`${this.baseUrl}/access`, request);
  }

  getPolicies() {
    return this.http.get<PolicyResponse[]>(`${this.baseUrl}/access`);
  }
}
