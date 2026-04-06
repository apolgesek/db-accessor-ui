// router-events.service.ts
import { inject, Injectable } from '@angular/core';
import {
  ActivationStart,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { SpinnerService } from './spinner.service';

@Injectable({ providedIn: 'root' })
export class RouterEventsService {
  private readonly spinner = inject(SpinnerService);
  private readonly router = inject(Router);
  private _skeletonType: number | null = 1;

  get skeletonType() {
    return this._skeletonType;
  }

  constructor() {
    this.spinner.setIsLoading(true);

    this.router.events
      .pipe(
        filter((x) => x instanceof ActivationStart),
        map((x) => x.snapshot.data['skeleton']),
      )
      .subscribe((v) => {
        this._skeletonType = v ?? 1;
      });

    this.router.events
      .pipe(
        filter(
          (e): e is NavigationStart | NavigationEnd | NavigationCancel | NavigationError =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
      )
      .subscribe((e) => {
        this.spinner.setIsLoading(e instanceof NavigationStart);
        if (
          e instanceof NavigationEnd ||
          e instanceof NavigationCancel ||
          e instanceof NavigationError
        ) {
          this.spinner.setIsLoading(false);
          this._skeletonType = null;
        }
      });
  }
}
