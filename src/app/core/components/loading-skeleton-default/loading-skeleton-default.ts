import { Component } from '@angular/core';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

@Component({
  selector: 'app-loading-skeleton-default',
  imports: [NzSkeletonModule],
  templateUrl: './loading-skeleton-default.html',
  styles: `
    nz-skeleton {
      margin-bottom: 1.5rem;
    }
  `,
})
export class LoadingSkeletonDefault {
  baseRows = ['30%', '100%'];
}
