import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BASE_URL } from '../base-url';
import { SessionSnapshot } from '../models';

@Injectable({
  providedIn: 'root',
})
export class SessionHttp {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BASE_URL);

  // Establishes the browser login session for the current login, or returns it unchanged.
  establish(): Observable<SessionSnapshot> {
    return this.http.post<SessionSnapshot>(`${this.baseUrl}/session`, null);
  }

  // Reports qualifying activity; the backend extends the session only while it is still active.
  recordActivity(): Observable<SessionSnapshot> {
    return this.http.post<SessionSnapshot>(`${this.baseUrl}/session/activity`, null);
  }
}
