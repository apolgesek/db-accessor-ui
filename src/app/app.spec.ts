import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
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
import { IS_USER_INPUT } from './core/user-input';
import { WEB_SOCKET_FACTORY } from './core/web-socket-factory';
import { icons } from './icons-provider';

const API = 'https://api.test';
const snapshot = { sessionId: 'lineage-1', serverNow: 1_000, idleExpiresAt: 901_000, revision: 1 };

@Component({ template: '<p class="protected-page">My requests</p>' })
class ProtectedPage {}

describe('application shell browser login session', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  let router: Router;
  let socketUrls: string[];
  let logout: jasmine.Spy;
  let reloadPage: jasmine.Spy;
  let checkAuth: jasmine.Spy;
  let storage: Storage | null;
  let userInput: WeakSet<Event>;

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
        { provide: IS_USER_INPUT, useValue: (event: Event) => userInput.has(event) },
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
    userInput = new WeakSet();
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
    expect(text()).not.toContain('Browser storage is blocked');
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

  it('explains that browser storage is blocked without checking the login, and reloading restarts', async () => {
    storage = null;
    setUp();
    await startAndOpenProtectedRoute();

    // OIDC keeps its state in the same storage, so checking the login would throw.
    expect(checkAuth).not.toHaveBeenCalled();
    http.expectNone(`${API}/session`);
    expect(text()).toContain('Browser storage is blocked for this site');
    expect(text()).not.toContain('Your session could not be started');
    expect(text()).toContain('Reload page');

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

  describe('qualifying activity', () => {
    const activityUrl = `${API}/session/activity`;

    // Starts an active session, then takes over the clock so coalescing windows and timeouts can be stepped.
    async function startActiveSession(): Promise<void> {
      setUp();
      await startAndOpenProtectedRoute();
      http.expectOne(`${API}/session`).flush(snapshot, { status: 201, statusText: 'Created' });
      await settle();
      http.expectOne(`${API}/notifications?limit=5`).flush({ count: 0, unreadCount: 0, items: [] });
      jasmine.clock().install();
    }

    // Dispatches an event the way user input arrives: on an element inside the app, bubbling.
    function userEvent(event: Event): void {
      userInput.add(event);
      (fixture.nativeElement as HTMLElement).dispatchEvent(event);
    }

    const press = () => userEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    const click = () => userEvent(new MouseEvent('click', { bubbles: true }));
    const reportOk = { ...snapshot, idleExpiresAt: 1_801_000, revision: 2 };

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('reports the first keydown immediately with an empty body', async () => {
      await startActiveSession();

      press();

      const report = http.expectOne(activityUrl);
      expect(report.request.method).toBe('POST');
      expect(report.request.body).toBeNull();
      report.flush(reportOk);
    });

    it('reports further events within 5 seconds exactly once at the end of the window, then stops', async () => {
      await startActiveSession();

      click();
      http.expectOne(activityUrl).flush(reportOk);
      jasmine.clock().tick(1_000);
      press();
      jasmine.clock().tick(2_000);
      click();
      jasmine.clock().tick(1_999);
      http.expectNone(activityUrl);

      jasmine.clock().tick(1);
      http.expectOne(activityUrl).flush(reportOk);

      jasmine.clock().tick(60_000);
      http.expectNone(activityUrl);
    });

    it('keeps one report in flight and sends the pending one when it completes', async () => {
      await startActiveSession();

      press();
      const slow = http.expectOne(activityUrl);
      jasmine.clock().tick(1_000);
      click();
      jasmine.clock().tick(6_000);
      http.expectNone(activityUrl);

      slow.flush(reportOk);

      http.expectOne(activityUrl).flush(reportOk);
      jasmine.clock().tick(60_000);
      http.expectNone(activityUrl);
    });

    it('abandons a hung report after 10 seconds without blocking later reports', async () => {
      await startActiveSession();

      press();
      const hung = http.expectOne(activityUrl);
      jasmine.clock().tick(1_000);
      press();
      jasmine.clock().tick(8_999);
      expect(hung.cancelled).toBeFalse();
      http.expectNone(activityUrl);

      jasmine.clock().tick(1);

      expect(hung.cancelled).toBeTrue();
      http.expectOne(activityUrl).flush(reportOk);
    });

    it('does not report scrolling, pointer movement, focus or visibility changes, or synthetic events', async () => {
      await startActiveSession();
      const page = fixture.nativeElement as HTMLElement;

      userEvent(new Event('scroll'));
      userEvent(new WheelEvent('wheel', { bubbles: true }));
      userEvent(new PointerEvent('pointermove', { bubbles: true }));
      userEvent(new PointerEvent('pointerdown', { bubbles: true }));
      userEvent(new FocusEvent('focusin', { bubbles: true }));
      const visibilityChange = new Event('visibilitychange');
      userInput.add(visibilityChange);
      document.dispatchEvent(visibilityChange);
      page.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
      page.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      http.expectNone(activityUrl);
    });

    it('does not report activity before the backend confirms the session', async () => {
      setUp();
      await startAndOpenProtectedRoute();

      press();
      click();

      http.expectNone(activityUrl);
      http.expectOne(`${API}/session`).flush(snapshot, { status: 201, statusText: 'Created' });
      await settle();
      http.expectOne(`${API}/notifications?limit=5`).flush({ count: 0, unreadCount: 0, items: [] });
      http.expectNone(activityUrl);
    });

    it('does not report business API requests', async () => {
      await startActiveSession();

      TestBed.inject(HttpClient).get(`${API}/request`).subscribe();
      http.expectOne(`${API}/request`).flush([]);
      jasmine.clock().tick(10_000);

      http.expectNone(activityUrl);
    });
  });
});

describe('user-input check', () => {
  it('treats script-dispatched events as not coming from the user', () => {
    const isUserInput = TestBed.inject(IS_USER_INPUT);

    expect(isUserInput(new KeyboardEvent('keydown', { key: 'a' }))).toBeFalse();
    expect(isUserInput(new MouseEvent('click'))).toBeFalse();
  });
});
