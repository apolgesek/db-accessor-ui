import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { finalize, switchMap } from 'rxjs';
import { PolicyResponse } from './services/policies-http';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { PolicyStrategy } from './policy-strategy';

type Policy = {
  userName: string;
  table: string;
  partitionKey: string;
  arn: string;
  creationDate: string;
  expiresAt: number;
  isExpiring: boolean;
};

@Component({
  selector: 'app-policies',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzSpinModule,
    NzAlertModule,
    NzDividerModule,
    NzTableModule,
    DatePipe,
    NgClass,
  ],
  templateUrl: './policies.html',
  styleUrl: './policies.scss',
})
export class Policies implements OnInit {
  isLoading = false;
  list: Policy[] = [];
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messageService = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly policyStrategy = inject(PolicyStrategy);

  form = this.fb.group({
    userName: this.fb.control<string | null>(null, [Validators.required]),
    tableName: this.fb.control<string | null>(null, [Validators.required]),
    partitionKey: this.fb.control<string | null>(null, [Validators.required]),
    duration: this.fb.control<number | null>(null, [Validators.required]),
    agree: this.fb.control<boolean | null>(null, [Validators.requiredTrue]),
  });

  ngOnInit(): void {
    this.list = this.mapPolicies(this.route.snapshot.data['list'] || []);
  }

  submitForm(): void {
    if (!this.form.valid) {
      Object.values(this.form.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });
      return;
    }

    this.isLoading = true;
    this.policyStrategy
      .addPolicy(this.form.getRawValue())
      .pipe(
        switchMap(() => this.policyStrategy.getPolicies()),
        finalize(() => (this.isLoading = false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((policies) => {
        this.list = this.mapPolicies(policies);
        this.messageService.success('Policy added');
        this.form.reset();
      });
  }

  private mapPolicies(policies: PolicyResponse[]): Policy[] {
    return policies.map((p) => {
      const fragments = p.policyName.split('_');
      return {
        ...p,
        table: fragments[2],
        partitionKey: fragments[3],
        isExpiring: p.expiresAt - Date.now() < 60 * 60 * 1000, // less than 1 hour
      };
    });
  }
}
