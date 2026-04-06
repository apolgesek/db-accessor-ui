import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URL } from '../../../core';
import { EntityRequest } from '../../../core/models';

export type ItemResponse<T> = {
  item: T;
  maskRuleset: string[];
  request: EntityRequest;
};

@Injectable({
  providedIn: 'root',
})
export class RecordHttp {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BASE_URL);

  getRecord(id: string): Observable<ItemResponse<unknown>> {
    return this.http.get<ItemResponse<unknown>>(`${this.baseUrl}/record/${id}`);
  }
}
