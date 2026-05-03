import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BASE_URL } from '../../../core';
import { AwsAccountsResponse, DynamoDbTable } from '../../../core/models';

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
}
