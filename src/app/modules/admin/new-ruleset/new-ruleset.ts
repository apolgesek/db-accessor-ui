import { KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import groupBy from 'lodash.groupby';
import { catchError, combineLatest, finalize, of, switchMap } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import {
  ActiveRulesetResponse,
  ActiveRulesetScope,
  AwsAccountsResponse,
  CreateRulesetRequestPayload,
  DynamoDbTable,
  RulesetOperator,
} from '../../../core/models';
import { SpinnerService } from '../../../core/services/spinner.service';
import { AccountsHttp } from '../../my-requests/services/accounts-http';
import { AdminHttp } from '../services/admin-http';
import { NzIconDirective } from 'ng-zorro-antd/icon';

type RulesetRuleFormType = {
  path: FormControl<string | null>;
};

type RulesetFormType = {
  table: FormControl<string | null>;
  targetPk: FormControl<string | null>;
  pkOperator: FormControl<RulesetOperator | null>;
  targetSk: FormControl<string | null>;
  skOperator: FormControl<RulesetOperator | null>;
  accountId: FormControl<string | null>;
  region: FormControl<string | null>;
  ruleset: FormArray<FormGroup<RulesetRuleFormType>>;
  version: FormControl<number | null>;
};

type DecodedRulesetId = {
  accountId: string;
  region: string;
  table: string;
  scopeKey: string;
};

@Component({
  selector: 'app-new-ruleset',
  imports: [
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzTypographyModule,
    NzSelectModule,
    KeyValuePipe,
    NzAlertModule,
    NzIconDirective,
    NzBreadCrumbModule,
    RouterLink,
  ],
  templateUrl: './new-ruleset.html',
})
export class NewRuleset implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminHttp = inject(AdminHttp);
  private readonly accountsHttp = inject(AccountsHttp);
  private readonly spinnerService = inject(SpinnerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  form!: FormGroup<RulesetFormType>;
  accountOptions: { value: string; label: string }[] = [];
  regionOptions: Record<string, { value: string; label: string }[]> = {};
  tables: DynamoDbTable[] = [];
  operatorOptions: { label: string; value: RulesetOperator }[] = [
    { label: 'Begins with', value: 'BEGINS_WITH' },
    { label: 'Equals', value: 'EQUALS' },
  ];
  activeRuleset: ActiveRulesetResponse | null = null;
  matchingScope: ActiveRulesetScope | null = null;
  isEditMode = false;

  get rulesetControls() {
    return this.form.controls.ruleset.controls;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Update ruleset' : 'Add ruleset';
  }

  get submitLabel(): string {
    return this.isEditMode ? 'Update' : 'Submit';
  }

  ngOnInit(): void {
    this.isEditMode = this.route.snapshot.paramMap.has('id');

    this.form = this.fb.group<RulesetFormType>({
      table: this.fb.control({ value: '', disabled: true }, { validators: [Validators.required] }),
      targetPk: this.fb.control('', { validators: [Validators.required] }),
      pkOperator: this.fb.control<RulesetOperator | null>(null, {
        validators: [Validators.required],
      }),
      targetSk: this.fb.control({ value: '', disabled: true }),
      skOperator: this.fb.control<RulesetOperator | null>({ value: null, disabled: true }),
      accountId: this.fb.control('', {
        validators: [Validators.required, Validators.pattern(/^\d{12}$/)],
      }),
      region: this.fb.control('', { validators: [Validators.required] }),
      ruleset: this.fb.array([this.createRuleForm()], { validators: [Validators.required] }),
      version: this.fb.control(0),
    });

    if (this.isEditMode) {
      this.form.controls.ruleset.disable({ emitEvent: false });
    }

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
        if (this.isEditMode) return;

        this.form.controls.table.setValue(null);
        this.form.controls.targetPk.setValue(null);
        this.form.controls.pkOperator.setValue(null);
        this.form.controls.targetSk.setValue(null);
        this.form.controls.skOperator.setValue(null);

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
        } else {
          this.tables = [];
          this.form.controls.table.disable();
          this.form.controls.targetSk.disable();
          this.form.controls.skOperator.disable();
        }
      });

    this.form.controls.table.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (this.isEditMode) return;

        this.activeRuleset = null;
        this.matchingScope = null;
        const info = this.tables.find((t) => t.name === v);
        if (info?.sk) {
          this.form.controls.targetSk.enable();
        } else {
          this.form.controls.targetSk.setValue(null);
          this.form.controls.targetSk.disable();
          this.form.controls.skOperator.setValue(null);
          this.form.controls.skOperator.disable();
        }
      });

    this.form.controls.table.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((v) => {
          if (!v) return of(null);
          const accountId = this.form.controls.accountId.value!;
          const region = this.form.controls.region.value!;
          this.spinnerService.setIsLoading(true);
          return this.adminHttp.getActiveRuleset(accountId, region, v).pipe(
            finalize(() => this.spinnerService.setIsLoading(false)),
            catchError(() => of(null)),
          );
        }),
      )
      .subscribe((ruleset) => {
        this.activeRuleset = ruleset;
        this.tryPrepopulateFromScope();
      });

    this.form.controls.targetPk.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tryPrepopulateFromScope());

    this.form.controls.pkOperator.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tryPrepopulateFromScope());

    this.form.controls.skOperator.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tryPrepopulateFromScope());

    this.form.controls.targetSk.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value && value.trim()) {
          this.form.controls.skOperator.enable();
          this.form.controls.skOperator.addValidators(Validators.required);
        } else {
          this.form.controls.skOperator.setValue(null);
          this.form.controls.skOperator.clearValidators();
          this.form.controls.skOperator.disable();
        }
        this.form.controls.skOperator.updateValueAndValidity({ emitEvent: false });
        this.tryPrepopulateFromScope();
      });

    if (this.isEditMode) {
      this.loadRulesetForEdit();
    }
  }

  createRuleForm(): FormGroup<RulesetRuleFormType> {
    return this.fb.group<RulesetRuleFormType>({
      path: this.fb.control('', { validators: [Validators.required, Validators.maxLength(255)] }),
    });
  }

  addRule() {
    this.form.controls.ruleset.push(this.createRuleForm());
  }

  removeRule(index: number) {
    if (this.form.controls.ruleset.length === 1) {
      return;
    }
    this.form.controls.ruleset.removeAt(index);
  }

  private loadRulesetForEdit(): void {
    const encodedId = this.route.snapshot.paramMap.get('id');
    const decodedId = encodedId ? this.decodeRulesetId(encodedId) : null;

    if (!decodedId) {
      this.disableEditScopeControls();
      this.setFormError('invalidRulesetId', 'Invalid ruleset identifier.');
      return;
    }

    this.form.patchValue(
      {
        accountId: decodedId.accountId,
        region: decodedId.region,
        table: decodedId.table,
      },
      { emitEvent: false },
    );
    this.disableEditScopeControls();

    this.spinnerService.setIsLoading(true);
    this.accountsHttp
      .getTables(decodedId.accountId, decodedId.region)
      .pipe(
        switchMap((tables) => {
          this.tables = tables;
          return this.adminHttp.getActiveRuleset(
            decodedId.accountId,
            decodedId.region,
            decodedId.table,
          );
        }),
        catchError(() => of(null)),
        finalize(() => {
          this.spinnerService.setIsLoading(false);
        }),
      )
      .subscribe((ruleset) => {
        if (!ruleset) {
          this.setFormError('rulesetLoad', 'Ruleset could not be loaded.');
          return;
        }

        const scope = ruleset.activeRulesets[decodedId.scopeKey];
        if (!scope) {
          this.setFormError('rulesetLoad', 'Ruleset scope not found.');
          return;
        }

        this.activeRuleset = ruleset;
        this.populateEditForm(scope);
        this.disableEditScopeControls();
        this.form.controls.ruleset.enable({ emitEvent: false });
      });
  }

  loadMatchingScope(): void {
    if (!this.matchingScope) return;

    const isPristine =
      this.form.controls.ruleset.length === 1 &&
      !this.form.controls.ruleset.at(0).controls.path.value?.trim();

    if (isPristine) {
      this.form.controls.ruleset.removeAt(0);
    }

    this.matchingScope.ruleset.forEach((rule) => {
      const group = this.createRuleForm();
      group.controls.path.setValue(rule.path);
      this.form.controls.ruleset.push(group);
    });
    this.matchingScope = null;
  }

  private tryPrepopulateFromScope(): void {
    if (this.isEditMode) {
      return;
    }

    if (!this.activeRuleset) {
      this.matchingScope = null;
      this.form.controls.ruleset.enable({ emitEvent: false });
      return;
    }

    const { targetPk, pkOperator, targetSk, skOperator } = this.form.getRawValue();
    if (!targetPk?.trim() || !pkOperator) {
      this.matchingScope = null;
      return;
    }

    const sk = targetSk?.trim() || null;
    if (sk && !skOperator) {
      this.matchingScope = null;
      return;
    }

    this.matchingScope =
      Object.values(this.activeRuleset.activeRulesets).find((scope) => {
        const pkMatch = scope.targetPk === targetPk.trim() && scope.pkOperator === pkOperator;
        if (!pkMatch) return false;
        return sk ? scope.targetSk === sk && scope.skOperator === skOperator : !scope.targetSk;
      }) ?? null;

    if (
      !this.matchingScope &&
      this.form.controls.accountId.valid &&
      this.form.controls.region.valid &&
      this.form.controls.table.valid &&
      this.form.controls.targetPk.valid &&
      this.form.controls.pkOperator.valid &&
      this.form.controls.targetSk.valid &&
      this.form.controls.skOperator.valid
    ) {
      this.form.controls.ruleset.enable();
    } else if (this.matchingScope) {
      this.form.controls.ruleset.disable();
    }
  }

  private populateEditForm(scope: ActiveRulesetScope): void {
    this.form.patchValue(
      {
        targetPk: scope.targetPk,
        pkOperator: scope.pkOperator ?? null,
        targetSk: scope.targetSk ?? null,
        skOperator: scope.skOperator ?? null,
        version: scope.version ?? 0,
      },
      { emitEvent: false },
    );

    this.form.controls.ruleset.clear();
    if (scope.ruleset.length) {
      scope.ruleset.forEach((rule) => {
        const group = this.createRuleForm();
        group.controls.path.setValue(rule.path, { emitEvent: false });
        this.form.controls.ruleset.push(group);
      });
    } else {
      this.form.controls.ruleset.push(this.createRuleForm());
    }
  }

  private disableEditScopeControls(): void {
    this.form.controls.accountId.disable({ emitEvent: false });
    this.form.controls.region.disable({ emitEvent: false });
    this.form.controls.table.disable({ emitEvent: false });
    this.form.controls.targetPk.disable({ emitEvent: false });
    this.form.controls.pkOperator.disable({ emitEvent: false });
    this.form.controls.targetSk.disable({ emitEvent: false });
    this.form.controls.skOperator.disable({ emitEvent: false });
  }

  private decodeRulesetId(value: string): DecodedRulesetId | null {
    try {
      const decoded = this.fromBase64Url(value);
      const [accountId, region, table, ...scopeParts] = decoded.split('#');
      const scopeKey = scopeParts.join('#');

      if (!accountId || !region || !table || !scopeKey) {
        return null;
      }

      return { accountId, region, table, scopeKey };
    } catch {
      return null;
    }
  }

  private fromBase64Url(value: string): string {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  }

  private setFormError(key: string, message: string): void {
    this.form.setErrors({ ...(this.form.errors ?? {}), [key]: message });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsDirty();
      (Object.keys(this.form.controls) as (keyof RulesetFormType)[]).forEach((key) => {
        this.form.controls[key].updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    const value = this.form.getRawValue();
    const targetSk = value.targetSk?.trim() ?? '';

    const payload: CreateRulesetRequestPayload = {
      accountId: value.accountId ?? '',
      region: value.region ?? '',
      table: value.table ?? '',
      ruleset: value.ruleset.map((rule) => ({
        path: rule.path?.trim() ?? '',
      })),
      targetPk: value.targetPk?.trim() ?? '',
      pkOperator: value.pkOperator ?? 'EQUALS',
      version: value.version ?? 0,
    };

    if (targetSk) {
      payload.targetSk = targetSk;
      if (value.skOperator) {
        payload.skOperator = value.skOperator;
      }
    }

    this.spinnerService.setIsLoading(true);
    this.adminHttp
      .createRulesetRequest(payload)
      .pipe(
        finalize(() => {
          this.spinnerService.setIsLoading(false);
        }),
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/admin/configuration']);
        },
        error: (err) => {
          if (err.status === 404) {
            this.form.setErrors({ notFound: 'Target entity not found' });
          }
        },
      });
  }
}
