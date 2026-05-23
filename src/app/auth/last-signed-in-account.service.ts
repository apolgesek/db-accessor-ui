import { inject, Injectable } from '@angular/core';
import { ConfigService } from '../core';

export type LastSignedInAccount = {
  username: string | null;
  email: string | null;
};

const LAST_SIGNED_IN_ACCOUNT_KEY = 'last-signed-in-account';
const CLEAR_AFTER_SIGN_IN_KEY = 'clear-last-signed-in-account-after-sign-in';

@Injectable({
  providedIn: 'root',
})
export class LastSignedInAccountService {
  private readonly configService = inject(ConfigService);

  get(): LastSignedInAccount | null {
    const value = localStorage.getItem(this.storageKey(LAST_SIGNED_IN_ACCOUNT_KEY));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as LastSignedInAccount;
    } catch {
      this.clearLastSignedInAccount();
      return null;
    }
  }

  set(account: LastSignedInAccount): void {
    if (!account.username && !account.email) {
      this.clearLastSignedInAccount();
      return;
    }

    localStorage.setItem(this.storageKey(LAST_SIGNED_IN_ACCOUNT_KEY), JSON.stringify(account));
  }

  clearLastSignedInAccount(): void {
    localStorage.removeItem(this.storageKey(LAST_SIGNED_IN_ACCOUNT_KEY));
  }

  clearAfterSignIn(): void {
    localStorage.setItem(this.storageKey(CLEAR_AFTER_SIGN_IN_KEY), 'true');
  }

  cancelClearAfterSignIn(): void {
    localStorage.removeItem(this.storageKey(CLEAR_AFTER_SIGN_IN_KEY));
  }

  clearIfSignInCompleted(): void {
    if (localStorage.getItem(this.storageKey(CLEAR_AFTER_SIGN_IN_KEY)) !== 'true') {
      return;
    }

    this.clearLastSignedInAccount();
    this.cancelClearAfterSignIn();
  }

  private storageKey(key: string): string {
    const prefix = this.configService.storagePrefix();

    return prefix ? `${prefix}_${key}` : key;
  }
}
