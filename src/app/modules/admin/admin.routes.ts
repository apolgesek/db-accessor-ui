import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import dayjs from 'dayjs';
import { map } from 'rxjs';
import { REQUESTS_FILTER } from '../../core';
import { EntityRequest } from '../../core/models';
import { AccountsHttp } from '../my-requests/services/accounts-http';
import { ConfigurationDashboard } from './configuration-dashboard/configuration-dashboard';
import { ListRuleset } from './list-ruleset/list-ruleset';
import { NewRuleset } from './new-ruleset/new-ruleset';
import { Requests } from './requests/requests';
import { AdminHttp } from './services/admin-http';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'all',
  },
  {
    path: 'all-requests',
    component: Requests,
    resolve: {
      title: () => 'All requests',
      filters: () => ['dateRange'],
      requests: () => {
        const adminHttp = inject(AdminHttp);
        const currentMonth = dayjs(new Date()).format('YYYY-MM');

        return adminHttp.getAllRequests([currentMonth, currentMonth]).pipe(
          map((r) => {
            return { ...r, currentMonth };
          }),
        );
      },
    },
  },
  {
    path: 'pending-requests',
    component: Requests,
    providers: [
      {
        provide: REQUESTS_FILTER,
        useValue: (item: EntityRequest) => item.status === 'PENDING',
      },
    ],
    resolve: {
      title: () => 'Pending requests',
      requests: () => {
        const adminHttp = inject(AdminHttp);
        return adminHttp.getPendingRequests();
      },
    },
  },
  {
    path: 'configuration',
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: ConfigurationDashboard,
      },
      {
        path: 'new-ruleset',
        pathMatch: 'full',
        redirectTo: 'add-ruleset',
      },
      {
        path: 'add-ruleset',
        component: NewRuleset,
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
        path: 'update-ruleset/:id',
        component: NewRuleset,
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
        path: 'list-ruleset',
        component: ListRuleset,
        resolve: {
          accounts: () => {
            const accountsHttp = inject(AccountsHttp);
            return accountsHttp.getAccounts();
          },
        },
      },
    ],
  },
];
