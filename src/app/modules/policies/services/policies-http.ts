import { inject, Injectable } from '@angular/core';
import { AddPolicyRequest } from '../models';
import { HttpClient } from '@angular/common/http';
import { BASE_URL } from '../../../core';
import { Observable } from 'rxjs';

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

  addIAMPolicy(request: AddPolicyRequest): Observable<PolicyResponse[]> {
    return this.http.post<PolicyResponse[]>(`${this.baseUrl}/iam/access`, request);
  }

  getIAMPolicies(): Observable<PolicyResponse[]> {
    return this.http.get<PolicyResponse[]>(`${this.baseUrl}/iam/access`);
  }

  addSSOPolicy(request: AddPolicyRequest): Observable<PolicyResponse[]> {
    return this.http.post<PolicyResponse[]>(`${this.baseUrl}/sso/access`, request);
  }

  getSSOPolicies(): Observable<PolicyResponse[]> {
    return this.http.get<PolicyResponse[]>(`${this.baseUrl}/sso/access`);
  }
}
