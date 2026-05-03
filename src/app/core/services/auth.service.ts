import { Injectable } from '@angular/core';

type AppRole = 'ADMIN' | 'USER';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  isAuthenticated = false;
  username: string | null = null;
  appRoles: AppRole[] = [];

  isAdmin() {
    return this.appRoles.includes('ADMIN');
  }

  setAuthData(
    isAuthenticated: boolean,
    userData: { username?: string },
    idTokenPayload: { ['cognito:groups']?: AppRole[] } | null,
  ) {
    this.isAuthenticated = isAuthenticated;
    this.username = (userData?.username as string)?.split('db-accessor' + '_')[1] || null;
    this.appRoles = idTokenPayload?.['cognito:groups'] || [];
  }
}
