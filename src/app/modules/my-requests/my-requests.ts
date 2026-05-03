import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconDirective } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { EntityRequestViewModel } from '../../core/models';
import { UnredactRequests } from '../../shared/unredact-requests/unredact-requests';

dayjs.extend(relativeTime);

function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);

  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);

  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

@Component({
  selector: 'app-my-requests',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzButtonModule,
    NzTableModule,
    DatePipe,
    NzTypographyModule,
    NzIconDirective,
    UnredactRequests,
    NzGridModule,
    RouterLink,
  ],
  templateUrl: './my-requests.html',
  styleUrls: ['./my-requests.scss'],
})
export class MyRequests implements OnInit {
  private readonly route = inject(ActivatedRoute);
  requests = this.route.snapshot.data['requests'] as {
    items: (EntityRequestViewModel & {
      isAvailable: boolean;
      urlId: string;
      progressPercent?: number;
      progressLabel?: string;
      isExpired?: boolean;
    })[];
  };
  expandSet = new Set<string>();

  ngOnInit(): void {
    this.requests.items = this.requests.items.map((item) => {
      const adminApprovedAt = item.approvedBy?.find((x) => x.role === 'ADMIN')?.approvedAt;
      const adminApprovedBy = item.approvedBy?.find((x) => x.role === 'ADMIN')?.username;
      const progress = this.buildProgress(item.duration, adminApprovedAt);

      return {
        ...item,
        adminApprovedBy: adminApprovedBy,
        adminApprovedAt: adminApprovedAt,
        progressPercent: progress.percent,
        progressLabel: progress.label,
        isExpired: progress.isExpired,
        urlId: base64urlEncode(item.SK),
      };
    });
  }

  onExpandChange(id: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
      const item = this.requests.items.find((x) => x.SK === id);
      item?.unredactRequests?.forEach((x) => (x.showDetails = false));
    }
  }

  expandAll() {
    this.requests.items.forEach((item) => this.expandSet.add(item.SK));
  }

  collapseAll() {
    this.requests.items.forEach((item) => {
      this.onExpandChange(item.SK, false);
    });
  }

  private buildProgress(
    durationHours: number,
    approvedAt?: string,
  ): { percent: number; label: string; isExpired: boolean } {
    if (!approvedAt || !durationHours || durationHours <= 0) {
      return { percent: 0, label: 'N/A', isExpired: false };
    }

    const start = dayjs(approvedAt);
    const end = start.add(durationHours, 'hour');
    const totalMs = end.diff(start);
    const remainingMs = end.diff(dayjs());

    if (remainingMs <= 0) {
      return { percent: 100, label: 'Expired', isExpired: true };
    }

    const elapsedPercent = Math.min(100, Math.max(0, ((totalMs - remainingMs) / totalMs) * 100));

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const pad = (n: number) => String(n).padStart(2, '0');
    const label = `${pad(hours)}h:${pad(minutes)}m`;

    return {
      percent: Math.round(elapsedPercent),
      label: label,
      isExpired: false,
    };
  }
}
