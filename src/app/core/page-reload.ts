import { InjectionToken } from '@angular/core';

// Reloads the page, re-running the whole startup.
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => () => window.location.reload(),
});
