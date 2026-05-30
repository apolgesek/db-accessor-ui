import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URL } from '../../../core';
import { CreateEntityRequestPayload, UserEntityRequestsResponse } from '../../../core/models';

@Injectable({
  providedIn: 'root',
})
export class RequestHttp {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BASE_URL);

  createRequest(request: CreateEntityRequestPayload): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/request`, request);
  }

  getRequests(): Observable<UserEntityRequestsResponse> {
    return this.http.get<UserEntityRequestsResponse>(`${this.baseUrl}/request`);
  }

  unredact(requestId: string, reason: string, paths: string[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/request/${requestId}/unredact`, { reason, paths });
  }
}
