import { HttpClient } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { defer, map, Observable, of, switchMap, take, tap } from 'rxjs';
import { LastSignedInAccountService } from '../auth/last-signed-in-account.service';
import { AppConfig } from './app-config';
import { AuthService } from './services/auth.service';
import { ConfigService } from './services/config.service';
import { SessionCoordinator } from './services/session-coordinator';

// App initializer: loads config.json, checks the OIDC login, and establishes the browser login session.
export function startApplication(): Observable<unknown> {
  const http = inject(HttpClient);
  const configService = inject(ConfigService);
  const oidcSecurityService = inject(OidcSecurityService);
  const authService = inject(AuthService);
  const lastSignedInAccountService = inject(LastSignedInAccountService);
  const injector = inject(Injector);

  const auth$ = defer(() => oidcSecurityService.checkAuth()).pipe(
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
      authService.setAuthData(isAuthenticated, userData, idTokenPayload, configService.auth()?.identityProviderName);
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

  // The coordinator reads BASE_URL, so it is resolved only after config.json has loaded. OIDC keeps its state in
  // the same shared storage, so the login is checked only once the coordinator confirms that storage works.
  return config$.pipe(
    switchMap(() => {
      const sessionCoordinator = injector.get(SessionCoordinator);
      if (!sessionCoordinator.canStart()) return of(undefined);

      return auth$.pipe(
        tap(({ isAuthenticated }) => {
          if (isAuthenticated) sessionCoordinator.start();
        }),
      );
    }),
  );
}
