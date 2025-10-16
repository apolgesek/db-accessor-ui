import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { icons } from './icons-provider';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { BASE_URL } from './core/base-url';
import { AppConfig, ConfigService } from './core';
import { tap } from 'rxjs';

registerLocaleData(en);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideAppInitializer(() => {
      const http = inject(HttpClient);
      const configService = inject(ConfigService);

      return http
        .get<AppConfig>('config.json')
        .pipe(tap((config: AppConfig) => (configService.apiUrl = config.apiUrl)));
    }),
    {
      provide: BASE_URL,
      deps: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return configService.apiUrl;
      },
    },
  ],
};
