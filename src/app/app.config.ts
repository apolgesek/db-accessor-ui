import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import en from '@angular/common/locales/en';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  AbstractSecurityStorage,
  authInterceptor,
  OidcSecurityService,
  OpenIdConfiguration,
  provideAuth,
  StsConfigHttpLoader,
  StsConfigLoader,
} from 'angular-auth-oidc-client';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { filter, forkJoin, map, of, switchMap, take, tap } from 'rxjs';
import { routes } from './app.routes';
import { LocalStorageService } from './auth/local-storage.service';
import { LastSignedInAccountService } from './auth/last-signed-in-account.service';
import { AppAuthConfig, AppConfig, ConfigService } from './core';
import { BASE_URL } from './core/base-url';
import { icons } from './icons-provider';
import { AuthService } from './core/services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterEventsService } from './core/services/router-events.service';

const authFactory = (configService: ConfigService) => {
  const obs$ = toObservable(configService.auth).pipe(
    filter(
      (authConfig): authConfig is AppAuthConfig =>
        authConfig !== null && authConfig.authority !== '' && authConfig.clientId !== '',
    ),
    map(
      (authConfig): OpenIdConfiguration => ({
        authority: authConfig.authority,
        redirectUrl: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
        clientId: authConfig.clientId,
        scope: authConfig.scope ?? 'openid email profile',
        responseType: 'code',
        silentRenew: true,
        useRefreshToken: true,
        renewTimeBeforeTokenExpiresInSeconds: 30,
        secureRoutes: [configService.apiUrl()],
      }),
    ),
  );

  return new StsConfigHttpLoader(obs$);
};

registerLocaleData(en);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideAnimationsAsync(),
    {
      provide: BASE_URL,
      deps: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return configService.apiUrl();
      },
    },
    // eagerly initialize router events service
    provideEnvironmentInitializer(() => {
      inject(RouterEventsService);
    }),
    provideAppInitializer(() => {
      const http = inject(HttpClient);
      const configService = inject(ConfigService);
      const oidcSecurityService = inject(OidcSecurityService);
      const authService = inject(AuthService);
      const lastSignedInAccountService = inject(LastSignedInAccountService);

      const auth$ = oidcSecurityService.checkAuth().pipe(
        take(1),
        switchMap(({ isAuthenticated, userData }) => {
          if (isAuthenticated) {
            return oidcSecurityService
              .getPayloadFromIdToken()
              .pipe(map((p) => ({ isAuthenticated, userData, idTokenPayload: p })));
          }

          return of({ isAuthenticated, userData, idTokenPayload: null });
        }),
        tap(({ isAuthenticated, userData, idTokenPayload }) => {
          authService.setAuthData(isAuthenticated, userData, idTokenPayload);
          if (isAuthenticated) {
            lastSignedInAccountService.clearIfSignInCompleted();
          }
        }),
      );

      const config$ = http.get<AppConfig>('config.json').pipe(
        tap((config: AppConfig) => {
          configService.apiUrl.set(config.apiUrl);
          configService.version.set(config.version);
          configService.webSocketUrl.set(config.webSocketUrl);
          configService.storagePrefix.set(config.storagePrefix ?? '');
          configService.auth.set(config.auth);
        }),
      );

      return forkJoin([config$, auth$]);
    }),
    provideHttpClient(withInterceptors([authInterceptor()])),
    provideAuth({
      loader: {
        provide: StsConfigLoader,
        useFactory: authFactory,
        deps: [ConfigService],
      },
    }),
    { provide: AbstractSecurityStorage, useClass: LocalStorageService },
  ],
};
