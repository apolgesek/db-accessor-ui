import { ActivatedRouteSnapshot, Routes } from '@angular/router';
import { Record } from './record';
import { RecordHttp } from '../services/record-http';
import { inject } from '@angular/core';

export const RECORD_ROUTES: Routes = [
  {
    path: ':id',
    component: Record,
    resolve: {
      record: (route: ActivatedRouteSnapshot) => {
        const id = route.paramMap.get('id') as string;
        const recordHttp = inject(RecordHttp);
        return recordHttp.getRecord(id);
      },
    },
  },
];
