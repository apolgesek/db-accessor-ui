import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { UnredactRequestViewModel } from '../../core/models';

@Component({
  selector: 'app-unredact-requests',
  templateUrl: './unredact-requests.html',
  imports: [DatePipe, NzIconModule],
})
export class UnredactRequests {
  private _unredactRequests: UnredactRequestViewModel[] = [];

  @Input()
  set unredactRequests(value: UnredactRequestViewModel[]) {
    this._unredactRequests = value ?? [];
  }

  get unredactRequests(): UnredactRequestViewModel[] {
    return this._unredactRequests;
  }

  toggle(unredactRequest: UnredactRequestViewModel, event: Event) {
    event.preventDefault();
    unredactRequest.showDetails = !unredactRequest.showDetails;
  }
}
