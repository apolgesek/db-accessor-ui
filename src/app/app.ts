import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ConfigService } from './core';
import { AuthService } from './core/services/auth.service';
import { NgClass } from '@angular/common';
import { SpinnerService } from './core/services/spinner.service';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { LoadingSkeletonTable } from './core/components/loading-skeleton-table/loading-skeleton-table';
import { RouterEventsService } from './core/services/router-events.service';
import { LoadingSkeletonDefault } from './core/components/loading-skeleton-default/loading-skeleton-default';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterOutlet,
    NzIconModule,
    NzLayoutModule,
    NzMenuModule,
    NzSpinModule,
    NgClass,
    NzButtonModule,
    LoadingSkeletonTable,
    LoadingSkeletonDefault,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly configService = inject(ConfigService);
  private readonly authService = inject(AuthService);
  private readonly spinnerService = inject(SpinnerService);
  private readonly routerEventsService = inject(RouterEventsService);

  appVersion = this.configService.version;

  get isAuthenticated() {
    return this.authService.isAuthenticated;
  }

  get username() {
    return this.authService.username;
  }

  get isAdmin() {
    return this.authService.isAdmin();
  }

  get isLoading() {
    return this.spinnerService.isLoading;
  }

  get skeletonType() {
    return this.routerEventsService.skeletonType;
  }

  logout(): void {
    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }

    const logoutUrl = `${window.location.protocol}//${window.location.host}/login`;
    window.location.href = `https://eu-central-16rlj50drm.auth.eu-central-1.amazoncognito.com/logout?client_id=6n5d5gru7c0ncf5npa0m5ls2n8&logout_uri=${encodeURIComponent(logoutUrl)}`;
  }
}
