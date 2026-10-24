import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { isSessionRejectionCode } from '../models';
import { PAGE_RELOAD } from '../page-reload';
import { SHARED_STORAGE } from '../shared-storage';
import { ConfigService } from './config.service';
import { LogoutService } from './logout.service';
import { SessionHttp } from './session-http';

export type SessionState =
  'bootstrapping' | 'setupError' | 'active' | 'warning' | 'locked' | 'terminating' | 'signedOut';

// One per tab. Establishes the browser login session at startup; routes and notifications wait for `active`.
@Injectable({
  providedIn: 'root',
})
export class SessionCoordinator {
  private readonly sessionHttp = inject(SessionHttp);
  private readonly storage = inject(SHARED_STORAGE);
  private readonly configService = inject(ConfigService);
  private readonly logoutService = inject(LogoutService);
  private readonly reloadPage = inject(PAGE_RELOAD);
  private readonly stateSignal = signal<SessionState>('bootstrapping');
  private readonly storageBlockedSignal = signal(false);
  private activeWaiters: (() => void)[] = [];

  readonly state = this.stateSignal.asReadonly();
  readonly storageBlocked = this.storageBlockedSignal.asReadonly();

  // Called before the OIDC login is checked, since OIDC keeps its state in the same storage. Without shared
  // storage the tabs cannot act as one session, so the tab shows the setup error instead of running one alone.
  canStart(): boolean {
    if (this.isStorageAvailable()) return true;

    this.storageBlockedSignal.set(true);
    this.stateSignal.set('setupError');
    return false;
  }

  // Called once the OIDC login is confirmed: fresh login, reload, or a new tab.
  start(): void {
    this.establish();
  }

  // Setup error screen: try establishing again, or rerun the whole startup if it never got past storage.
  retry(): void {
    if (this.state() !== 'setupError') return;

    if (this.storageBlocked()) this.reloadPage();
    else this.establish();
  }

  whenActive(): Promise<void> {
    if (this.state() === 'active') return Promise.resolve();

    return new Promise((resolve) => this.activeWaiters.push(resolve));
  }

  private establish(): void {
    this.stateSignal.set('bootstrapping');
    this.sessionHttp.establish().subscribe({
      next: () => {
        this.stateSignal.set('active');
        const waiters = this.activeWaiters;
        this.activeWaiters = [];
        waiters.forEach((resolve) => resolve());
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 401 && isSessionRejectionCode(error.error?.code)) {
          // The backend refused this login's session, so only a new login can start one.
          this.stateSignal.set('terminating');
          this.logoutService.logout();
          return;
        }

        this.stateSignal.set('setupError');
      },
    });
  }

  private isStorageAvailable(): boolean {
    if (!this.storage) return false;

    const probeKey = `${this.configService.storagePrefix()}:session-storage-probe`;
    try {
      this.storage.setItem(probeKey, '1');
      this.storage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  }
}
