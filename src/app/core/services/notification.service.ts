import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { catchError, Observable, of, Subscription, take, tap, throwError } from 'rxjs';
import { ConfigService } from './config.service';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { toSignal } from '@angular/core/rxjs-interop';
import { BASE_URL } from '../base-url';

export type RequestNotification = {
  id: string;
  userId: string;
  status: 'APPROVED' | 'REJECTED';
  requestId: string;
  requestPk: string;
  requestSk: string;
  accountId: string;
  region: string;
  table: string;
  targetPk: string;
  targetSk?: string;
  reason: string;
  comment?: string | null;
  createdAt: string;
  actorUsername: string;
  readAt?: string;
};

export type RequestStatusChangedMessage = {
  type: 'REQUEST_STATUS_CHANGED';
  notification: RequestNotification;
};

export type NotificationsResponse = {
  count: number;
  unreadCount: number;
  items: RequestNotification[];
  nextCursor?: string;
};

export type MarkNotificationsReadResponse = {
  count: number;
  unreadCount: number;
  items: RequestNotification[];
};

const LATEST_NOTIFICATIONS_LIMIT = 5;

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(BASE_URL);
  private readonly configService = inject(ConfigService);
  private readonly oidcService = inject(OidcSecurityService);
  private readonly injector = inject(Injector);
  private readonly notificationState = signal<RequestNotification[]>([]);
  private readonly unreadNotificationCountState = signal(0);
  private socket$: WebSocketSubject<RequestStatusChangedMessage> | null = null;
  private socketSubscription?: Subscription;
  private token = toSignal(this.oidcService.getIdToken(), { injector: this.injector });

  notifications = this.notificationState.asReadonly();
  unreadNotifications = computed(() => this.notificationState().filter((notification) => !notification.readAt));
  notificationCount = computed(() => this.unreadNotificationCountState());

  loadNotifications(): void {
    this.getNotificationsPage(LATEST_NOTIFICATIONS_LIMIT)
      .pipe(take(1))
      .subscribe({
        error: (error) => console.error('Failed to load notifications', error),
      });
  }

  getNotificationsPage(limit: number, cursor?: string): Observable<NotificationsResponse> {
    let params = new HttpParams().set('limit', limit);
    if (cursor) {
      params = params.set('cursor', cursor);
    }

    return this.http.get<NotificationsResponse>(`${this.baseUrl}/notifications`, { params }).pipe(
      tap(({ items, unreadCount }) => {
        this.unreadNotificationCountState.set(unreadCount);
        this.upsertNotifications(items);
      }),
    );
  }

  markNotificationsRead(notificationIds: string[]): Observable<MarkNotificationsReadResponse> {
    const unreadNotificationIds = new Set(
      this.notificationState()
        .filter((notification) => notificationIds.includes(notification.id) && !notification.readAt)
        .map((notification) => notification.id),
    );

    if (!unreadNotificationIds.size) {
      return of({
        count: 0,
        unreadCount: this.notificationCount(),
        items: [],
      });
    }

    const readAt = new Date().toISOString();
    this.markNotificationsReadLocally(unreadNotificationIds, readAt);
    this.unreadNotificationCountState.update((count) => Math.max(0, count - unreadNotificationIds.size));

    return this.http
      .post<MarkNotificationsReadResponse>(`${this.baseUrl}/notifications/read`, {
        notificationIds: [...unreadNotificationIds],
      })
      .pipe(
        tap(({ items, unreadCount }) => {
          const markedNotificationIds = new Set(items.map((notification) => notification.id));
          const unmarkedNotificationIds = new Set(
            [...unreadNotificationIds].filter((id) => !markedNotificationIds.has(id)),
          );
          if (unmarkedNotificationIds.size) {
            this.markNotificationsUnreadLocally(unmarkedNotificationIds);
          }

          this.unreadNotificationCountState.set(unreadCount);
          this.upsertNotifications(items);
        }),
        catchError((error) => {
          this.markNotificationsUnreadLocally(unreadNotificationIds);
          this.unreadNotificationCountState.update((count) => count + unreadNotificationIds.size);

          return throwError(() => error);
        }),
      );
  }

  connect(): void {
    if (this.socket$) return;

    const token = this.token();
    if (token) {
      this.openConnection(token);
      return;
    }

    this.oidcService
      .getIdToken()
      .pipe(take(1))
      .subscribe((idToken) => {
        if (!idToken || this.socket$) return;

        this.openConnection(idToken);
      });
  }

  getMessages(): Observable<RequestStatusChangedMessage | null> {
    if (!this.socket$) return of(null);

    return this.socket$.asObservable();
  }

  closeConnection(): void {
    if (!this.socket$) return;

    this.socketSubscription?.unsubscribe();
    this.socket$.complete();
    this.socket$ = null;
    this.socketSubscription = undefined;
  }

  private openConnection(token: string): void {
    const webSocketUrl = this.configService.webSocketUrl();
    if (!webSocketUrl) return;

    this.socket$ = webSocket<RequestStatusChangedMessage>(
      `${webSocketUrl}?token=${encodeURIComponent(token)}`,
    );
    this.socketSubscription = this.socket$.subscribe({
      next: (message) => this.receiveMessage(message),
      error: (error) => {
        console.error('Notification websocket error', error);
        this.resetConnection();
      },
      complete: () => this.resetConnection(),
    });
  }

  private receiveMessage(message: RequestStatusChangedMessage): void {
    if (message.type !== 'REQUEST_STATUS_CHANGED') return;

    this.applyUnreadCountChange(message.notification);
    this.upsertNotifications([message.notification]);
  }

  private applyUnreadCountChange(notification: RequestNotification): void {
    const existingNotification = this.notificationState().find((item) => item.id === notification.id);
    const wasUnread = existingNotification ? !existingNotification.readAt : false;
    const isUnread = !notification.readAt;

    if (isUnread && !wasUnread) {
      this.unreadNotificationCountState.update((count) => count + 1);
    }

    if (!isUnread && wasUnread) {
      this.unreadNotificationCountState.update((count) => Math.max(0, count - 1));
    }
  }

  private upsertNotifications(incoming: RequestNotification[]): void {
    this.notificationState.update((notifications) => {
      const byId = new Map(notifications.map((notification) => [notification.id, notification]));

      for (const notification of incoming) {
        byId.set(notification.id, { ...byId.get(notification.id), ...notification });
      }

      return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  private markNotificationsReadLocally(notificationIds: Set<string>, readAt: string): void {
    this.notificationState.update((notifications) =>
      notifications.map((notification) =>
        notificationIds.has(notification.id) ? { ...notification, readAt: notification.readAt ?? readAt } : notification,
      ),
    );
  }

  private markNotificationsUnreadLocally(notificationIds: Set<string>): void {
    this.notificationState.update((notifications) =>
      notifications.map((notification) =>
        notificationIds.has(notification.id) ? { ...notification, readAt: undefined } : notification,
      ),
    );
  }

  private resetConnection(): void {
    this.socketSubscription?.unsubscribe();
    this.socket$ = null;
    this.socketSubscription = undefined;
  }
}
