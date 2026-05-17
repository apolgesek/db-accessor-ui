import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import groupBy from 'lodash.groupby';
import { finalize } from 'rxjs';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { ActiveRulesetScope, AwsAccountsResponse, DynamoDbTable } from '../../../core/models';
import { SpinnerService } from '../../../core/services/spinner.service';
import { AccountsHttp } from '../../my-requests/services/accounts-http';
import { AdminHttp } from '../services/admin-http';

type ScopeRow = {
  scopeKey: string;
  targetPk: string;
  pkOperator?: 'BEGINS_WITH' | 'EQUALS';
  targetSk?: string;
  skOperator?: 'BEGINS_WITH' | 'EQUALS';
  paths: string[];
  updatedAt: string;
};

@Component({
  selector: 'app-list-ruleset',
  imports: [
    FormsModule,
    DatePipe,
    KeyValuePipe,
    RouterLink,
    NzBreadCrumbModule,
    NzButtonModule,
    NzDatePickerModule,
    NzIconModule,
    NzSelectModule,
    NzTableModule,
    NzTypographyModule,
  ],
  templateUrl: './list-ruleset.html',
})
export class ListRuleset implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminHttp = inject(AdminHttp);
  private readonly accountsHttp = inject(AccountsHttp);
  private readonly spinnerService = inject(SpinnerService);

  accountOptions: { value: string; label: string }[] = [];
  regionOptions: Record<string, { value: string; label: string }[]> = {};
  tables: DynamoDbTable[] = [];
  tableSelectDisabled = true;

  selectedAccount: string | null = null;
  selectedRegion: string | null = null;
  selectedTable: string | null = null;

  private allScopes: ScopeRow[] = [];
  filteredScopes: ScopeRow[] = [];
  expandSet = new Set<string>();

  ngOnInit(): void {
    const data = this.route.snapshot.data['accounts'] as AwsAccountsResponse;

    this.accountOptions = data.accounts
      .map((a) => ({ value: a.id, label: `${a.name} (${a.id})` }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const regionOptions = data.regions.map((r) => ({ value: r.code, label: r.longName }));
    this.regionOptions = groupBy(regionOptions, (opt) => opt.label.split('(')[0].trim());
  }

  onAccountChange(value: string | null): void {
    this.selectedAccount = value;
    this.onAccountOrRegionChange();
  }

  onRegionChange(value: string | null): void {
    this.selectedRegion = value;
    this.onAccountOrRegionChange();
  }

  onTableChange(value: string | null): void {
    this.selectedTable = value;
    this.clearScopes();

    if (value && this.selectedAccount && this.selectedRegion) {
      this.spinnerService.setIsLoading(true);
      this.adminHttp
        .getActiveRuleset(this.selectedAccount, this.selectedRegion, value)
        .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
        .subscribe((res) => {
          this.allScopes = Object.entries(res.activeRulesets).map(
            ([scopeKey, scope]: [string, ActiveRulesetScope]) => ({
              scopeKey,
              targetPk: scope.targetPk,
              pkOperator: scope.pkOperator,
              targetSk: scope.targetSk,
              skOperator: scope.skOperator,
              paths: scope.ruleset.map((r) => r.path),
              updatedAt: scope.updatedAt,
            }),
          );
          this.filteredScopes = this.allScopes;
        });
    }
  }

  private onAccountOrRegionChange(): void {
    this.selectedTable = null;
    this.tables = [];
    this.tableSelectDisabled = true;
    this.clearScopes();

    if (this.selectedAccount && this.selectedRegion) {
      this.spinnerService.setIsLoading(true);
      this.accountsHttp
        .getTables(this.selectedAccount, this.selectedRegion)
        .pipe(finalize(() => this.spinnerService.setIsLoading(false)))
        .subscribe((tables) => {
          this.tables = tables;
          this.tableSelectDisabled = false;
        });
    }
  }

  private clearScopes(): void {
    this.allScopes = [];
    this.filteredScopes = [];
    this.expandSet.clear();
  }

  onExpandChange(scopeKey: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(scopeKey);
    } else {
      this.expandSet.delete(scopeKey);
    }
  }

  expandAll(): void {
    this.filteredScopes.forEach((row) => this.expandSet.add(row.scopeKey));
  }

  collapseAll(): void {
    this.expandSet.clear();
  }

  onEdit(row: ScopeRow): void {
    if (!this.selectedAccount || !this.selectedRegion || !this.selectedTable) {
      return;
    }

    const rulesetKey = [
      this.selectedAccount,
      this.selectedRegion,
      this.selectedTable,
      row.scopeKey,
    ].join('#');

    this.router.navigate(['/admin/configuration/update-ruleset', this.toBase64Url(rulesetKey)]);
  }

  onRemove(row: ScopeRow): void {
    // TODO: call delete API
    console.log('remove', row);
  }

  private toBase64Url(value: string): string {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
