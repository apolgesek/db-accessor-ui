import { Routes } from '@angular/router';
import { MyRequests } from './my-requests';
import { canMatchAuthenticated } from '../../core/guards/can-match-authenticated.guard';
import { NewRequest } from './new-request/new-request';
import { RequestHttp } from './services/request-http';
import { inject } from '@angular/core';
import { AccountsHttp } from './services/accounts-http';

export const MY_REQUESTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'all',
  },
  {
    path: 'all',
    canMatch: [canMatchAuthenticated],
    component: MyRequests,
    resolve: {
      requests: () => {
        const requestHttp = inject(RequestHttp);
        return requestHttp.getRequests();
      },
    },
  },
  {
    path: 'new',
    canMatch: [canMatchAuthenticated],
    component: NewRequest,
    data: {
      skeleton: 2,
    },
    resolve: {
      accounts: () => {
        const accountsHttp = inject(AccountsHttp);
        return accountsHttp.getAccounts();
      },
    },
  },
  {
    path: 'record',
    canMatch: [canMatchAuthenticated],
    loadChildren: () => import('./record/record.routes').then((m) => m.RECORD_ROUTES),
  },
];
