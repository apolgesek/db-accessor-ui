import { Component } from '@angular/core';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';

@Component({
  selector: 'app-loading-skeleton-table',
  imports: [NzSkeletonModule, NzTableModule],
  templateUrl: './loading-skeleton-table.html',
})
export class LoadingSkeletonTable {
  skeletonCols = Array(7);
  skeletonRows = Array(7);

  trackFn() {
    return crypto.randomUUID();
  }
}
