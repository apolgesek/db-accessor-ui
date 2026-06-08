import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URL } from '../../../core';
import { AwsAccountsResponse, ConfiguredDynamoDbTable, DynamoDbTable } from '../../../core/models';

@Injectable({
  providedIn: 'root',
})
export class AccountsHttp {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BASE_URL);

  getAccounts(): Observable<AwsAccountsResponse> {
    return this.http.get<AwsAccountsResponse>(`${this.baseUrl}/accounts`);
  }

  getTables(account: string, region: string): Observable<DynamoDbTable[]> {
    return this.http.get<DynamoDbTable[]>(
      `${this.baseUrl}/tables?account=${account}&region=${region}`,
    );
  }

  getConfiguredTables(accountId?: string, region?: string): Observable<ConfiguredDynamoDbTable[]> {
    let params = new HttpParams();
    if (accountId) {
      params = params.set('accountId', accountId);
    }
    if (region) {
      params = params.set('region', region);
    }

    return this.http.get<ConfiguredDynamoDbTable[]>(`${this.baseUrl}/configured-tables`, {
      params,
    });
  }
}
