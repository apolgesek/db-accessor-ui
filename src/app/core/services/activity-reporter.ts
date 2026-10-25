import { DOCUMENT, inject, Injectable } from '@angular/core';
import { finalize, Subscription, timeout } from 'rxjs';
import { IS_USER_INPUT } from '../user-input';
import { SessionCoordinator } from './session-coordinator';

const QUALIFYING_EVENTS = ['keydown', 'click'] as const;
const COALESCING_WINDOW_MS = 5_000;
const REPORT_TIMEOUT_MS = 10_000;

// Reports qualifying activity to the backend. Observes only that a keydown or click happened, never its key or
// target. Per tab, the first event is reported immediately and later ones are coalesced into one report at the
// end of a 5-second window; with nothing pending it stops, so there is no heartbeat. At most one report is in
// flight, and a report that gets no answer within 10 seconds is abandoned so it cannot hold back later ones.
@Injectable({
  providedIn: 'root',
})
export class ActivityReporter {
  private readonly document = inject(DOCUMENT);
  private readonly sessionCoordinator = inject(SessionCoordinator);
  private readonly isUserInput = inject(IS_USER_INPUT);
  private windowTimer: ReturnType<typeof setTimeout> | undefined;
  private pending = false;
  private reportInFlight = false;
  private inFlightReport: Subscription | undefined;

  private readonly onActivity = (event: Event): void => {
    if (!this.isUserInput(event) || !this.canReport()) return;

    this.pending = true;
    this.flush();
  };

  start(): void {
    for (const type of QUALIFYING_EVENTS) {
      this.document.addEventListener(type, this.onActivity, { capture: true });
    }
  }

  stop(): void {
    for (const type of QUALIFYING_EVENTS) {
      this.document.removeEventListener(type, this.onActivity, { capture: true });
    }
    clearTimeout(this.windowTimer);
    this.windowTimer = undefined;
    this.pending = false;
    this.inFlightReport?.unsubscribe();
  }

  private flush(): void {
    if (!this.pending || this.windowTimer || this.reportInFlight) return;

    this.pending = false;
    if (!this.canReport()) return;

    this.windowTimer = setTimeout(() => {
      this.windowTimer = undefined;
      this.flush();
    }, COALESCING_WINDOW_MS);
    this.reportInFlight = true;
    this.inFlightReport = this.sessionCoordinator
      .reportActivity()
      .pipe(
        timeout(REPORT_TIMEOUT_MS),
        finalize(() => {
          this.reportInFlight = false;
          this.flush();
        }),
      )
      // A failed report extends nothing: the backend's deadline stands.
      .subscribe({ error: () => undefined });
  }

  // Only a session the backend confirmed as active can be extended.
  private canReport(): boolean {
    const state = this.sessionCoordinator.state();
    return state === 'active' || state === 'warning';
  }
}
