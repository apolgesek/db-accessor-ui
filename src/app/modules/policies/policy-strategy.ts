import { Observable } from 'rxjs';
import { AddPolicyRequest } from './models';
import { PolicyResponse } from './services/policies-http';

export abstract class PolicyStrategy {
  abstract addPolicy(request: AddPolicyRequest): Observable<PolicyResponse[]>;
  abstract getPolicies(): Observable<PolicyResponse[]>;
}
