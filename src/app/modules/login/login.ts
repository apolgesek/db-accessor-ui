import { Component, inject, signal } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import {
  LastSignedInAccount,
  LastSignedInAccountService,
} from '../../auth/last-signed-in-account.service';
import { NzIconModule } from 'ng-zorro-antd/icon';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  imports: [NzButtonModule, NzCardModule, NzTypographyModule, NzIconModule],
})
export class Login {
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly lastSignedInAccountService = inject(LastSignedInAccountService);

  lastSignedInAccount = signal<LastSignedInAccount | null>(this.lastSignedInAccountService.get());

  login() {
    this.oidcSecurityService.authorize();
  }

  loginAsLastSignedInAccount(): void {
    this.lastSignedInAccountService.cancelClearAfterSignIn();
    this.login();
  }
}
