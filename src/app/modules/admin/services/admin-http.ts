import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URL } from '../../../core';
import {
  ActiveRulesetResponse,
  CreateRulesetRequestPayload,
  EntityRequest,
  EntityRequestsResponse,
  RequestDecisionResponse,
} from '../../../core/models';

@Injectable({
  providedIn: 'root',
})
export class AdminHttp {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BASE_URL);

  createRulesetRequest(request: CreateRulesetRequestPayload): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/admin/create-ruleset`, request);
  }

  getAllRequests(dates?: string[]): Observable<EntityRequestsResponse> {
    const options = dates
      ? { params: new HttpParams().set('startDate', dates[0]).set('endDate', dates[1]) }
      : {};

    return this.http.get<EntityRequestsResponse>(`${this.baseUrl}/admin/request`, options);
  }

  getPendingRequests(): Observable<EntityRequestsResponse> {
    const options = { params: new HttpParams().set('status', 'PENDING') };
    return this.http.get<EntityRequestsResponse>(`${this.baseUrl}/admin/request`, options);
  }

  approveRequest(
    PK: EntityRequest['PK'],
    SK: EntityRequest['SK'],
    comment?: string | null,
  ): Observable<RequestDecisionResponse> {
    return this.http.put<RequestDecisionResponse>(`${this.baseUrl}/admin/approve-request`, {
      PK,
      SK,
      comment,
    });
  }

  rejectRequest(
    PK: EntityRequest['PK'],
    SK: EntityRequest['SK'],
    comment: string,
  ): Observable<RequestDecisionResponse> {
    return this.http.put<RequestDecisionResponse>(`${this.baseUrl}/admin/reject-request`, {
      PK,
      SK,
      comment,
    });
  }

  getActiveRuleset(
    accountId: string,
    region: string,
    table: string,
  ): Observable<ActiveRulesetResponse> {
    const params = new HttpParams()
      .set('accountId', accountId)
      .set('region', region)
      .set('table', table);
    return this.http.get<ActiveRulesetResponse>(`${this.baseUrl}/admin/ruleset`, { params });
  }
}
