import { Injectable, signal } from '@angular/core';
import { AppAuthConfig } from '../app-config';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  apiUrl = signal('');
  auth = signal<AppAuthConfig | null>(null);
  webSocketUrl = signal('');
  version = signal('');
  storagePrefix = signal('');
}
