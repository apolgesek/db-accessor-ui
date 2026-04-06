import { Component, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTypographyModule } from 'ng-zorro-antd/typography';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  imports: [NzButtonModule, NzTypographyModule],
})
export class Login {
  private readonly oidcSecurityService = inject(OidcSecurityService);

  login() {
    this.oidcSecurityService.authorize();
  }
}
