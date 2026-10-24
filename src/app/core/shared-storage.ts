import { InjectionToken } from '@angular/core';

// The browser's shared localStorage, or null when the browser refuses access to it.
export const SHARED_STORAGE = new InjectionToken<Storage | null>('SHARED_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  },
});
