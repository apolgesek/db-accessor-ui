import { DatePipe, NgClass } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { finalize, take } from 'rxjs';
import {
  NotificationService,
  RequestNotification,
} from '../../core/services/notification.service';

const NOTIFICATIONS_PAGE_SIZE = 20;
const SCROLL_LOAD_THRESHOLD_PX = 160;

@Component({
  selector: 'app-notifications',
  imports: [DatePipe, NgClass, NzListModule, NzSpinModule, NzTagModule, NzTypographyModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
})
export class Notifications implements OnInit, AfterViewInit {
  private readonly notificationService = inject(NotificationService);
  @ViewChild('scroller') private readonly scroller?: ElementRef<HTMLElement>;
  private nextCursor?: string;
  private viewReady = false;

  notifications = this.notificationService.notifications;
  isLoading = signal(false);
  hasLoaded = signal(false);
  hasMore = signal(true);

  ngOnInit(): void {
    this.loadNextPage();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.loadNextPageIfScrollableSpace();
  }

  onScroll(event: Event): void {
    const target = event.target as HTMLElement;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;

    if (distanceToBottom <= SCROLL_LOAD_THRESHOLD_PX) {
      this.loadNextPage();
    }
  }

  loadNextPage(): void {
    if (this.isLoading() || !this.hasMore()) return;

    this.isLoading.set(true);
    this.notificationService
      .getNotificationsPage(NOTIFICATIONS_PAGE_SIZE, this.nextCursor)
      .pipe(
        take(1),
        finalize(() => {
          this.isLoading.set(false);
          this.hasLoaded.set(true);
          setTimeout(() => this.loadNextPageIfScrollableSpace());
        }),
      )
      .subscribe({
        next: ({ items, nextCursor }) => {
          this.nextCursor = nextCursor;
          this.hasMore.set(Boolean(nextCursor));
          setTimeout(() => this.markUnreadNotificationsRead(items));
        },
        error: (error) => console.error('Failed to load notifications page', error),
      });
  }

  notificationTitle(notification: RequestNotification): string {
    return notification.targetSk
      ? `${notification.targetPk} / ${notification.targetSk}`
      : notification.targetPk;
  }

  private loadNextPageIfScrollableSpace(): void {
    const scroller = this.scroller?.nativeElement;
    if (!this.viewReady || !scroller || this.isLoading() || !this.hasMore()) return;

    if (scroller.scrollHeight - scroller.clientHeight <= SCROLL_LOAD_THRESHOLD_PX) {
      this.loadNextPage();
    }
  }

  private markUnreadNotificationsRead(notifications: RequestNotification[]): void {
    const unreadids = notifications
      .filter((notification) => !notification.readAt)
      .map((notification) => notification.id);

    if (!unreadids.length) return;

    this.notificationService
      .markNotificationsRead(unreadids)
      .pipe(take(1))
      .subscribe({
        error: (error) => console.error('Failed to mark notifications read', error),
      });
  }
}
