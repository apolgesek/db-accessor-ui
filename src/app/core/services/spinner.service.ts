import { computed, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SpinnerService {
  isLoading = computed(() => this._isLoading() > 0);
  private _isLoading = signal(0);

  setIsLoading(value: boolean) {
    if (value) {
      this._isLoading.update((v) => v + 1);
    } else {
      this._isLoading.update((v) => {
        if (v > 0) return v - 1;

        return 0;
      });
    }
  }
}
