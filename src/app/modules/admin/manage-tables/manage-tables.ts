import { showValidationErrors } from '../../../core/form-validation';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { accountRegionOptions, accountRegions } from '../../../core/account-regions';
import { distinctUntilChanged, finalize, Subscription } from 'rxjs';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { AwsAccountsResponse, ConfiguredDynamoDbTable, DynamoDbTable } from '../../../core/models';
import { SpinnerService } from '../../../core/services/spinner.service';
import { AccountsHttp } from '../../my-requests/services/accounts-http';
import { AdminHttp } from '../services/admin-http';

type ManageTablesFormType = {
  accountId: FormControl<string | null>;
  region: FormControl<string | null>;
  table: FormControl<string | null>;
};

@Component({
  selector: 'app-manage-tables',
  imports: [
    DatePipe,
    KeyValuePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzBreadCrumbModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTypographyModule,
  ],
  templateUrl: './manage-tables.html',
})
export class ManageTables implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly accountsHttp = inject(AccountsHttp);
  private readonly adminHttp = inject(AdminHttp);
  private readonly spinnerService = inject(SpinnerService);
  private readonly messageService = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private tablesRequest?: Subscription;

  form!: FormGroup<ManageTablesFormType>;
  accountOptions: { value: string; label: string }[] = [];
  regionOptions: ReturnType<typeof accountRegionOptions> = {};
  availableTables: DynamoDbTable[] = [];
  configuredTables: ConfiguredDynamoDbTable[] = [];
  filteredTables: ConfiguredDynamoDbTable[] = [];
  expandSet = new Set<string>();
  tableSelectDisabled = true;
  private readonly piiDetectionUpdating = new Set<string>();

  ngOnInit(): void {
    this.form = this.fb.group<ManageTablesFormType>({
      accountId: this.fb.control('', {
        validators: [Validators.required, Validators.pattern(/^\d{12}$/)],
      }),
      region: this.fb.control('', { validators: [Validators.required] }),
      table: this.fb.control({ value: '', disabled: true }, { validators: [Validators.required] }),
    });

    const data = this.route.snapshot.data['accounts'] as AwsAccountsResponse;
    this.configuredTables = this.route.snapshot.data[
      'configuredTables'
    ] as ConfiguredDynamoDbTable[];
    this.filteredTables = this.configuredTables;

    this.accountOptions = data.accounts
      .map((account) => ({
        value: account.id,
        label: `${account.name} (${account.id})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    this.form.controls.accountId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((accountId) => {
        this.regionOptions = accountRegionOptions(this.route.snapshot.data['accounts'], accountId);
        this.form.controls.region.setValue(null, { emitEvent: false });
        this.onAccountOrRegionChange();
      });
    this.form.controls.region.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onAccountOrRegionChange());
  }

  submit(): void {
    if (this.form.invalid) {
      showValidationErrors(this.form);
      return;
    }

    const value = this.form.getRawValue();
    this.spinnerService.setIsLoading(true);
    this.adminHttp
      .createConfiguredTable({
        accountId: value.accountId ?? '',
        region: value.region ?? '',
        table: value.table ?? '',
      })
      .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
      .subscribe({
        next: () => {
          this.messageService.success('Table added');
          this.form.controls.table.setValue(null);
          this.reloadConfiguredTables();
        },
        error: (err) => {
          this.messageService.error(
            err.status === 409 ? 'Table is already configured' : 'Table could not be added',
          );
        },
      });
  }

  onRemove(row: ConfiguredDynamoDbTable): void {
    this.spinnerService.setIsLoading(true);
    this.adminHttp
      .deleteConfiguredTable(row.accountId, row.region, row.name)
      .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
      .subscribe({
        next: () => {
          this.messageService.success('Table removed');
          this.expandSet.delete(this.rowKey(row));
          this.reloadConfiguredTables();
        },
        error: () => {
          this.messageService.error('Table could not be removed');
        },
      });
  }

  isPiiDetectionUpdating(row: ConfiguredDynamoDbTable): boolean {
    return this.piiDetectionUpdating.has(this.rowKey(row));
  }

  onPiiDetectionChange(
    row: ConfiguredDynamoDbTable,
    enabled: boolean,
    control: FormControl<boolean>,
  ): void {
    const key = this.rowKey(row);
    this.piiDetectionUpdating.add(key);
    this.adminHttp
      .updatePiiDetection({
        accountId: row.accountId,
        region: row.region,
        table: row.name,
        enabled,
      })
      .pipe(finalize(() => this.piiDetectionUpdating.delete(key)))
      .subscribe({
        next: (response) => {
          row.piiDetectionEnabled = response.piiDetectionEnabled;
          this.messageService.success(
            enabled
              ? 'PII scanning enabled; an initial scan has been queued'
              : 'PII scanning disabled',
          );
        },
        error: () => {
          control.setValue(row.piiDetectionEnabled, {
            emitEvent: false,
            emitViewToModelChange: false,
          });
          this.messageService.error('PII scanning setting could not be updated');
        },
      });
  }

  onExpandChange(id: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
    }
  }

  expandAll(): void {
    this.filteredTables.forEach((row) => this.expandSet.add(this.rowKey(row)));
  }

  collapseAll(): void {
    this.expandSet.clear();
  }

  rowKey(row: ConfiguredDynamoDbTable): string {
    return `${row.accountId}#${row.region}#${row.name}`;
  }

  private onAccountOrRegionChange(): void {
    this.tablesRequest?.unsubscribe();
    this.form.controls.table.setValue(null);
    this.availableTables = [];
    this.tableSelectDisabled = true;
    this.form.controls.table.disable();
    this.reloadConfiguredTables();

    const accountId = this.form.controls.accountId.value;
    const region = this.form.controls.region.value;

    if (
      accountId &&
      region &&
      accountRegions(this.route.snapshot.data['accounts'], accountId).some((r) => r.code === region)
    ) {
      this.spinnerService.setIsLoading(true);
      this.tablesRequest = this.accountsHttp
        .getTables(accountId, region)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.spinnerService.setIsLoading(false)),
        )
        .subscribe({
          next: (tables) => {
            this.availableTables = tables;
            this.tableSelectDisabled = false;
            this.form.controls.table.enable();
          },
          error: () => this.messageService.error('Tables could not be loaded'),
        });
    }
  }

  private reloadConfiguredTables(): void {
    const accountId = this.form.controls.accountId.value || undefined;
    const region = accountId ? this.form.controls.region.value || undefined : undefined;

    this.accountsHttp.getConfiguredTables(accountId, region).subscribe((tables) => {
      this.configuredTables = tables;
      this.filteredTables = tables;
    });
  }
}
