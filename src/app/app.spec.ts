import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, Subject } from 'rxjs';
import { App } from './app';
import { startApplication } from './core/app-startup';
import { BASE_URL } from './core/base-url';
import { canMatchAuthenticated } from './core/guards/can-match-authenticated.guard';
import { LogoutService } from './core/services/logout.service';
import { PAGE_RELOAD } from './core/page-reload';
import { SHARED_STORAGE } from './core/shared-storage';
import { WEB_SOCKET_FACTORY } from './core/web-socket-factory';
import { icons } from './icons-provider';

const API = 'https://api.test';
const snapshot = { sessionId: 'lineage-1', serverNow: 1_000, idleExpiresAt: 901_000, revision: 1 };

@Component({ template: '<p class="protected-page">My requests</p>' })
class ProtectedPage {}

describe('application shell session bootstrap', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  let router: Router;
  let socketUrls: string[];
  let logout: jasmine.Spy;
  let reloadPage: jasmine.Spy;
  let checkAuth: jasmine.Spy;
  let storage: Storage | null;

  function setUp() {
    socketUrls = [];
    logout = jasmine.createSpy('logout');
    reloadPage = jasmine.createSpy('reloadPage');
    checkAuth = jasmine
      .createSpy('checkAuth')
      .and.returnValue(of({ isAuthenticated: true, userData: { username: 'alice' } }));
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'my-requests', canMatch: [canMatchAuthenticated], component: ProtectedPage },
          { path: 'login', component: ProtectedPage },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideNzIcons(icons),
        { provide: BASE_URL, useValue: API },
        {
          provide: OidcSecurityService,
          useValue: {
            checkAuth,
            getPayloadFromIdToken: () => of({}),
            getAccessToken: () => of('fake-access-token'),
            getIdToken: () => of('fake-id-token'),
            logoffLocal: () => undefined,
          },
        },
        { provide: SHARED_STORAGE, useValue: storage },
        {
          provide: WEB_SOCKET_FACTORY,
          useValue: (url: string) => {
            socketUrls.push(url);
            return new Subject();
          },
        },
        { provide: LogoutService, useValue: { logout } },
        { provide: PAGE_RELOAD, useValue: reloadPage },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  }

  // Not fixture.whenStable(): it also waits for the router, and navigation waits for the session.
  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
  }

  // Runs the real app initializer, as bootstrap does, then opens a protected route.
  async function startAndOpenProtectedRoute(): Promise<void> {
    TestBed.runInInjectionContext(startApplication).subscribe();
    http.expectOne('config.json').flush({
      version: 'test',
      apiUrl: API,
      webSocketUrl: 'wss://ws.test',
      storagePrefix: 'test',
      auth: { authority: 'https://idp.test', clientId: 'web-client' },
    });
    void router.navigateByUrl('/my-requests');
    await settle();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    storage = window.localStorage;
  });

  afterEach(() => {
    http.verify();
  });

  it('activates routes and notifications only after the backend confirms the session', async () => {
    setUp();
    await startAndOpenProtectedRoute();

    const establish = http.expectOne(`${API}/session`);
    expect(establish.request.method).toBe('POST');
    expect(text()).not.toContain('My requests');
    expect(socketUrls).toEqual([]);
    http.expectNone(`${API}/notifications?limit=5`);

    establish.flush(snapshot, { status: 201, statusText: 'Created' });
    await settle();

    expect(router.url).toBe('/my-requests');
    expect(text()).toContain('My requests');
    http.expectOne(`${API}/notifications?limit=5`).flush({ count: 0, unreadCount: 0, items: [] });
    expect(socketUrls).toEqual(['wss://ws.test?token=fake-access-token']);
  });

  it('shows the setup error when the session store is unavailable, and Retry recovers', async () => {
    setUp();
    await startAndOpenProtectedRoute();

    http
      .expectOne(`${API}/session`)
      .flush(
        { message: 'Session unavailable', code: 'SESSION_UNAVAILABLE' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await settle();

    expect(text()).toContain('Your session could not be started');
    expect(text()).not.toContain('My requests');
    expect(socketUrls).toEqual([]);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.app__session-retry')!
      .click();
    await settle();
    http.expectOne(`${API}/session`).flush(snapshot, { status: 200, statusText: 'OK' });
    await settle();

    expect(text()).toContain('My requests');
    http.expectOne(`${API}/notifications?limit=5`).flush({ count: 0, unreadCount: 0, items: [] });
  });

  it('shows the setup error when the backend cannot be reached', async () => {
    setUp();
    await startAndOpenProtectedRoute();

    http.expectOne(`${API}/session`).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await settle();

    expect(text()).toContain('Your session could not be started');
    expect(text()).not.toContain('My requests');
    expect(logout).not.toHaveBeenCalled();
  });

  it('shows the setup error without checking the login when shared storage is unavailable, and Retry restarts', async () => {
    storage = null;
    setUp();
    await startAndOpenProtectedRoute();

    // OIDC keeps its state in the same storage, so checking the login would throw.
    expect(checkAuth).not.toHaveBeenCalled();
    http.expectNone(`${API}/session`);
    expect(text()).toContain('Your session could not be started');

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.app__session-retry')!
      .click();
    expect(reloadPage).toHaveBeenCalled();
  });

  it('ends the login when the backend refuses to establish its session', async () => {
    setUp();
    await startAndOpenProtectedRoute();

    http
      .expectOne(`${API}/session`)
      .flush(
        { message: 'Login required', code: 'LOGIN_REQUIRED' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await settle();

    expect(logout).toHaveBeenCalled();
    expect(text()).not.toContain('My requests');
  });
});
