import { Injectable } from '@angular/core';

type AppRole = 'ADMIN' | 'USER';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  isAuthenticated = false;
  username: string | null = null;
  email: string | null = null;
  appRoles: AppRole[] = [];

  isAdmin() {
    return this.appRoles.includes('ADMIN');
  }

  setAuthData(
    isAuthenticated: boolean,
    userData: { username?: string; email?: string; name?: string },
    idTokenPayload: { ['cognito:groups']?: AppRole[]; email?: string; name?: string } | null,
    identityProviderName?: string,
  ) {
    this.isAuthenticated = isAuthenticated;
    const usernamePrefix = identityProviderName ? `${identityProviderName}_` : '';
    const username = userData?.username;
    this.username =
      (usernamePrefix && username?.startsWith(usernamePrefix) ? username.slice(usernamePrefix.length) : username) ||
      userData?.name ||
      idTokenPayload?.name ||
      null;
    this.email = userData?.email ?? idTokenPayload?.email ?? null;
    this.appRoles = idTokenPayload?.['cognito:groups'] || [];
  }
}
