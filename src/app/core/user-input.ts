import { InjectionToken } from '@angular/core';

// Whether a DOM event came from the user rather than a script. Injected because tests cannot produce trusted
// events.
export const IS_USER_INPUT = new InjectionToken<(event: Event) => boolean>('IS_USER_INPUT', {
  providedIn: 'root',
  factory: () => (event) => event.isTrusted,
});
