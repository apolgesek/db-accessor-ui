import { inject, Injectable } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { ConfigService } from './config.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class LogoutService {
  private readonly configService = inject(ConfigService);
  private readonly notificationService = inject(NotificationService);
  private readonly oidcSecurityService = inject(OidcSecurityService);

  // Clears local credentials and redirects through the Cognito logout to the login page.
  logout(): void {
    const auth = this.configService.auth();

    this.notificationService.closeConnection();
    this.oidcSecurityService.logoffLocal();

    if (!auth?.clientId || !auth.authority) {
      window.location.assign(window.location.origin);
      return;
    }

    const logoutUrl = new URL(`${auth.cognitoDomain}/logout`);

    logoutUrl.searchParams.set('client_id', auth.clientId);
    logoutUrl.searchParams.set('logout_uri', `${window.location.origin}/login`);

    window.location.assign(logoutUrl.toString());
  }
}
