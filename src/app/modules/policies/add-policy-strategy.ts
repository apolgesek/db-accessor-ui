import { Observable } from 'rxjs';
import { AddPolicyRequest } from './models';
import { PolicyResponse } from './services/policies-http';

export abstract class AddPolicyStrategy {
  abstract addPolicy(request: AddPolicyRequest): Observable<PolicyResponse[]>;
}
