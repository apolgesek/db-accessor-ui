import { InjectionToken } from '@angular/core';
import { EntityRequest } from '../models';

export const REQUESTS_FILTER = new InjectionToken<(item: EntityRequest) => boolean>(
  'REQUESTS_FILTER',
);
