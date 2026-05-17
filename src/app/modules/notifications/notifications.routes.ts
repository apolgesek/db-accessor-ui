import { Routes } from '@angular/router';
import { Notifications } from './notifications';
import { canMatchAuthenticated } from '../../core/guards/can-match-authenticated.guard';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    canMatch: [canMatchAuthenticated],
    component: Notifications,
  },
];
