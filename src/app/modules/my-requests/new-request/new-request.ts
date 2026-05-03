import { Component, DestroyRef, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { combineLatest, finalize } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { RequestHttp } from '../services/request-http';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { NzSelectModule } from 'ng-zorro-antd/select';
import groupBy from 'lodash.groupby';
import { KeyValuePipe } from '@angular/common';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { AccountsHttp } from '../services/accounts-http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AwsAccountsResponse,
  CreateEntityRequestPayload,
  DynamoDbTable,
} from '../../../core/models';

type RequestFormType = {
  duration: FormControl<number | null>;
  table: FormControl<string | null>;
  targetPK: FormControl<string | null>;
  targetSK: FormControl<string | null>;
  reason: FormControl<string | null>;
  issueKey: FormControl<string | null>;
  accountId: FormControl<string | null>;
  region: FormControl<string | null>;
};

@Component({
  selector: 'app-new-request',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzButtonModule,
    NzTypographyModule,
    NzSelectModule,
    KeyValuePipe,
    NzAlertModule,
  ],
  templateUrl: './new-request.html',
})
export class NewRequest implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly requestHttp = inject(RequestHttp);
  private readonly accountsHttp = inject(AccountsHttp);
  private readonly spinnerService = inject(SpinnerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  form!: FormGroup<RequestFormType>;
  accountOptions: { value: string; label: string }[] = [];
  regionOptions: Record<string, { value: string; label: string }[]> = {};
  tables: DynamoDbTable[] = [];

  @ViewChild('ref') formElement!: ElementRef;

  get selectedTableHasSortKey(): boolean {
    const tableName = this.form?.controls.table.value;
    return !!this.tables.find((table) => table.name === tableName)?.sK;
  }

  ngOnInit(): void {
    this.form = this.fb.group<RequestFormType>({
      duration: this.fb.control<number | null>(null, {
        validators: [Validators.required, Validators.min(1), Validators.max(24)],
      }),
      table: this.fb.control({ value: '', disabled: true }, { validators: [Validators.required] }),
      targetPK: this.fb.control('', { validators: [Validators.required] }),
      targetSK: this.fb.control({ value: '', disabled: true }),
      reason: this.fb.control('', {
        validators: [Validators.required, Validators.maxLength(1024)],
      }),
      issueKey: this.fb.control('', {
        validators: [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]*-\d+$/i)],
      }),
      accountId: this.fb.control('', {
        validators: [Validators.required, Validators.pattern(/^\d{12}$/)],
      }),
      region: this.fb.control('', { validators: [Validators.required] }),
    });

    const accountsData = (this.route.snapshot.data['accounts'] as AwsAccountsResponse).accounts;
    this.accountOptions = accountsData
      .map((account) => ({
        value: account.id,
        label: `${account.name} (${account.id})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const regionsData = (this.route.snapshot.data['accounts'] as AwsAccountsResponse).regions;
    const regionOptions = regionsData.map((region) => ({
      value: region.code,
      label: region.longName,
    }));
    this.regionOptions = groupBy(regionOptions, (opt) => opt.label.split('(')[0].trim());

    const accountIdChanges = this.form.controls.accountId.valueChanges;
    const regionChanges = this.form.controls.region.valueChanges;

    combineLatest([accountIdChanges, regionChanges])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([account, region]) => {
        this.form.controls.table.setValue(null);
        this.form.controls.targetPK.setValue(null);
        this.form.controls.targetSK.setValue(null);

        if (account && region) {
          this.spinnerService.setIsLoading(true);
          this.accountsHttp
            .getTables(account, region)
            .pipe(
              finalize(() => {
                this.spinnerService.setIsLoading(false);
              }),
            )
            .subscribe((tables) => {
              this.tables = tables;
              this.form.controls.table.enable();
            });
        }
      });

    this.form.controls.table.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const info = this.tables.find((t) => t.name === v);
        if (info?.sK) {
          this.form.controls.targetSK.enable();
          this.form.controls.targetSK.setValidators([Validators.required]);
        } else {
          this.form.controls.targetSK.setValue(null);
          this.form.controls.targetSK.clearValidators();
          this.form.controls.targetSK.disable();
        }
        this.form.controls.targetSK.updateValueAndValidity();
      });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsDirty();
      (Object.keys(this.form.controls) as (keyof RequestFormType)[]).forEach((key) => {
        this.form.controls[key].updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    this.spinnerService.setIsLoading(true);
    this.requestHttp
      .createRequest(this.createPayload())
      .pipe(
        finalize(() => {
          this.spinnerService.setIsLoading(false);
        }),
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/my-requests/all']);
        },
        error: (err) => {
          if (err.status === 404) {
            this.form.setErrors({ notFound: 'Target entity not found' });
          }
        },
      });
  }

  private createPayload(): CreateEntityRequestPayload {
    const value = this.form.getRawValue();
    const payload: CreateEntityRequestPayload = {
      duration: value.duration ?? 0,
      table: value.table ?? '',
      targetPK: value.targetPK?.trim() ?? '',
      reason: value.reason?.trim() ?? '',
      issueKey: value.issueKey?.trim().toUpperCase() ?? '',
      accountId: value.accountId ?? '',
      region: value.region ?? '',
    };

    const targetSK = value.targetSK?.trim();
    if (targetSK) {
      payload.targetSK = targetSK;
    }

    return payload;
  }
}
