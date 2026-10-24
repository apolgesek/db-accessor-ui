import { InjectionToken } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';

export type WebSocketFactory = <T>(url: string) => Subject<T>;

export const WEB_SOCKET_FACTORY = new InjectionToken<WebSocketFactory>('WEB_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => webSocket(url),
});
