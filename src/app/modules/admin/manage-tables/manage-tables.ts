import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import groupBy from 'lodash.groupby';
import { finalize } from 'rxjs';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import {
  AwsAccountsResponse,
  ConfiguredDynamoDbTable,
  DynamoDbTable,
} from '../../../core/models';
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
    NzDrawerModule,
    NzFormModule,
    NzIconModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
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

  form!: FormGroup<ManageTablesFormType>;
  accountOptions: { value: string; label: string }[] = [];
  regionOptions: Record<string, { value: string; label: string }[]> = {};
  availableTables: DynamoDbTable[] = [];
  configuredTables: ConfiguredDynamoDbTable[] = [];
  filteredTables: ConfiguredDynamoDbTable[] = [];
  expandSet = new Set<string>();
  aiAssistanceByTable: Record<string, boolean> = {};
  aiAssistanceDrawerVisible = false;
  tableSelectDisabled = true;

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

    const regionOptions = data.regions.map((region) => ({
      value: region.code,
      label: region.longName,
    }));
    this.regionOptions = groupBy(regionOptions, (opt) => opt.label.split('(')[0].trim());

    this.form.controls.accountId.valueChanges.subscribe(() => this.onAccountOrRegionChange());
    this.form.controls.region.valueChanges.subscribe(() => this.onAccountOrRegionChange());
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsDirty();
      Object.values(this.form.controls).forEach((control) =>
        control.updateValueAndValidity({ onlySelf: true }),
      );
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
          this.messageService.error(err.status === 409 ? 'Table is already configured' : 'Table could not be added');
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

  isAiAssistanceEnabled(row: ConfiguredDynamoDbTable): boolean {
    return this.aiAssistanceByTable[this.rowKey(row)] ?? false;
  }

  onAiAssistanceChange(row: ConfiguredDynamoDbTable, enabled: boolean): void {
    this.aiAssistanceByTable[this.rowKey(row)] = enabled;
  }

  openAiAssistanceDrawer(): void {
    this.aiAssistanceDrawerVisible = true;
  }

  closeAiAssistanceDrawer(): void {
    this.aiAssistanceDrawerVisible = false;
  }

  private onAccountOrRegionChange(): void {
    this.form.controls.table.setValue(null);
    this.availableTables = [];
    this.tableSelectDisabled = true;
    this.form.controls.table.disable();
    this.reloadConfiguredTables();

    const accountId = this.form.controls.accountId.value;
    const region = this.form.controls.region.value;

    if (accountId && region) {
      this.spinnerService.setIsLoading(true);
      this.accountsHttp
        .getTables(accountId, region)
        .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
        .subscribe((tables) => {
          this.availableTables = tables;
          this.tableSelectDisabled = false;
          this.form.controls.table.enable();
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
