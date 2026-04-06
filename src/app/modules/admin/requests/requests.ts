import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import dayjs from 'dayjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { UnredactRequests } from '../../../shared/unredact-requests/unredact-requests';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { finalize } from 'rxjs';
import { REQUESTS_FILTER } from '../../../core';
import { EntityRequest, EntityRequestViewModel } from '../../../core/models';
import { SpinnerService } from '../../../core/services/spinner.service';
import { AdminHttp } from '../services/admin-http';

@Component({
  selector: 'app-requests',
  templateUrl: './requests.html',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzButtonModule,
    NzTableModule,
    DatePipe,
    NzTypographyModule,
    FormsModule,
    NzDatePickerModule,
    NzIconModule,
    UnredactRequests,
  ],
})
export class Requests implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly adminHttp = inject(AdminHttp);
  private readonly spinnerService = inject(SpinnerService);
  private readonly requestsFilter = inject(REQUESTS_FILTER, { optional: true }) ?? (() => true);
  requests!: EntityRequestViewModel[];
  expandSet = new Set<string>();
  date: Date[] = [];

  get title() {
    return this.route.snapshot.data['title'];
  }

  get filters() {
    return this.route.snapshot.data['filters'];
  }

  ngOnInit(): void {
    const currentMonth = this.route.snapshot.data['requests'].currentMonth;
    this.requests = this.route.snapshot.data['requests'].items.map(this.mapItem);
    this.date = [new Date(currentMonth), new Date(currentMonth)];
  }

  onExpandChange(id: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
      const item = this.requests.find((x) => x.SK === id);
      if (item?.status === 'PENDING' && item?.comment) {
        item.comment = null;
      }

      item?.unredactRequests?.forEach((x) => (x.showDetails = false));
    }
  }

  expandAll() {
    this.requests.forEach((item: EntityRequestViewModel) => this.expandSet.add(item.SK));
  }

  collapseAll() {
    this.requests.forEach((req) => {
      this.onExpandChange(req.SK, false);
    });
  }

  onChange() {
    this.spinnerService.setIsLoading(true);
    this.adminHttp
      .getAllRequests(this.date.map((x) => dayjs(x).format('YYYY-MM')))
      .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
      .subscribe((r) => {
        this.requests = r.items.map(this.mapItem);
      });
  }

  approve(request: EntityRequest) {
    this.spinnerService.setIsLoading(true);
    this.adminHttp
      .approveRequest(request.PK, request.SK, request.comment)
      .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
      .subscribe((item) => {
        const idx = this.requests.findIndex((x) => x.PK === request.PK && x.SK === request.SK);
        if (idx >= 0) {
          this.requests[idx] = this.mapItem(item);
        }
        this.requests = this.requests.filter(this.requestsFilter);
      });
  }

  reject(request: EntityRequest) {
    this.spinnerService.setIsLoading(true);
    this.adminHttp
      .rejectRequest(request.PK, request.SK, request.comment ?? '')
      .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
      .subscribe((item) => {
        const idx = this.requests.findIndex((x) => x.PK === request.PK && x.SK === request.SK);
        if (idx >= 0) {
          this.requests[idx] = this.mapItem(item);
        }
        this.requests = this.requests.filter(this.requestsFilter);
      });
  }

  mapItem(item: EntityRequest): EntityRequestViewModel {
    const approvedAt = item.approvedBy?.find((x) => x.role === 'ADMIN')?.approvedAt;
    const approvedBy = item.approvedBy?.find((x) => x.role === 'ADMIN')?.username;

    return {
      ...item,
      unredactRequests: item.unredactRequests?.map((x) => ({ ...x, showDetails: false })),
      adminApprovedBy: approvedBy,
      adminApprovedAt: approvedAt,
    };
  }
}
