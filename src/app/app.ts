import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ConfigService } from './core';
import { AuthService } from './core/services/auth.service';
import { DatePipe, NgClass } from '@angular/common';
import { SpinnerService } from './core/services/spinner.service';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { LoadingSkeletonTable } from './core/components/loading-skeleton-table/loading-skeleton-table';
import { RouterEventsService } from './core/services/router-events.service';
import { LoadingSkeletonDefault } from './core/components/loading-skeleton-default/loading-skeleton-default';
import { NotificationService } from './core/services/notification.service';
import { LastSignedInAccountService } from './auth/last-signed-in-account.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterOutlet,
    NzBadgeModule,
    NzDropDownModule,
    NzIconModule,
    NzLayoutModule,
    NzMenuModule,
    NzSpinModule,
    NgClass,
    DatePipe,
    NzButtonModule,
    LoadingSkeletonTable,
    LoadingSkeletonDefault,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  private readonly configService = inject(ConfigService);
  private readonly authService = inject(AuthService);
  private readonly spinnerService = inject(SpinnerService);
  private readonly routerEventsService = inject(RouterEventsService);
  private readonly notificationService = inject(NotificationService);
  private readonly lastSignedInAccountService = inject(LastSignedInAccountService);

  appVersion = this.configService.version;
  notifications = this.notificationService.notifications;
  unreadNotifications = this.notificationService.unreadNotifications;
  notificationCount = this.notificationService.notificationCount;
  latestNotifications = computed(() => this.notifications().slice(0, 5));

  ngOnInit(): void {
    if (this.isAuthenticated) {
      this.notificationService.loadNotifications();
      this.notificationService.connect();
    }
  }

  ngOnDestroy(): void {
    this.notificationService.closeConnection();
  }

  get isAuthenticated() {
    return this.authService.isAuthenticated;
  }

  get username() {
    return this.authService.username;
  }

  get email() {
    return this.authService.email;
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
    this.notificationService.closeConnection();

    const lastSignedInAccount = {
      username: this.username,
      email: this.email,
    };

    if (window.localStorage) {
      window.localStorage.clear();
      this.lastSignedInAccountService.set(lastSignedInAccount);
    }

    window.location.href =
      'https://eu-central-16rlj50drm.auth.eu-central-1.amazoncognito.com/logout?client_id=6n5d5gru7c0ncf5npa0m5ls2n8&logout_uri=http%3A%2F%2Flocalhost%3A4200%2Flogin';
  }

}
