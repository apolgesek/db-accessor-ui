import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  apiUrl = signal('');
  webSocketUrl = signal('');
  version = signal('');
  storagePrefix = signal('');
}
