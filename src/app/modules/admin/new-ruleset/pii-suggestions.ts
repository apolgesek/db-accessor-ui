import { DatePipe, PercentPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of, shareReplay, Subject, switchMap, tap } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzIconDirective } from 'ng-zorro-antd/icon';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PiiSuggestionsResponse } from '../../../core/models';
import { AdminHttp } from '../services/admin-http';
import { AccountsHttp } from '../../my-requests/services/accounts-http';

@Component({
  selector: 'app-pii-suggestions',
  imports: [
    DatePipe,
    PercentPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzIconDirective,
    NzTableModule,
  ],
  templateUrl: './pii-suggestions.html',
  styles: `
    .checkbox-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class PiiSuggestions implements OnChanges {
  @Input() accountId: string | null = null;
  @Input() region: string | null = null;
  @Input() table: string | null = null;
  @Input() existingPaths: string[] = [];
  @Input() disabled = false;
  @Output() pathsSelected = new EventEmitter<string[]>();

  private readonly adminHttp = inject(AdminHttp);
  private readonly accountsHttp = inject(AccountsHttp);
  private readonly reload = new Subject<void>();
  private readonly configuredTablesCache = new Map<string, ReturnType<AccountsHttp['getConfiguredTables']>>();
  response: PiiSuggestionsResponse | null = null;
  loading = false;
  error = false;
  unconfigured = false;
  drawerOpen = false;
  selectedPaths = new Set<string>();

  constructor() {
    this.reload
      .pipe(
        switchMap(() => {
          this.response = null;
          this.error = false;
          this.unconfigured = false;
          this.drawerOpen = false;
          this.selectedPaths.clear();
          this.loading = !!(this.accountId && this.region && this.table);
          const { accountId, region, table } = this;
          if (!accountId || !region || !table) return of(null);
          return this.getConfiguredTables(accountId, region).pipe(
            switchMap((tables) => {
              this.unconfigured = !tables.some(
                (configured) =>
                  configured.accountId === accountId &&
                  configured.region === region &&
                  configured.name === table,
              );
              return this.unconfigured
                ? of(null)
                : this.adminHttp.getPiiSuggestions(accountId, region, table);
            }),
            catchError(() => {
              this.error = true;
              return of(null);
            })
          );
        }),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe((response) => {
        this.response = response;
        this.loading = false;
      });
  }

  private getConfiguredTables(accountId: string, region: string) {
    const cacheKey = JSON.stringify([accountId, region]);
    const cached = this.configuredTablesCache.get(cacheKey);
    if (cached) return cached;

    const request = this.accountsHttp.getConfiguredTables(accountId, region).pipe(
      tap({ error: () => this.configuredTablesCache.delete(cacheKey) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.configuredTablesCache.set(cacheKey, request);
    return request;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountId'] || changes['region'] || changes['table']) this.refresh();
  }

  refresh(): void {
    this.reload.next();
  }

  isExisting(path: string): boolean {
    return this.existingPaths.some((existing) => existing.trim() === path);
  }

  get availablePaths(): string[] {
    return (this.response?.suggestions ?? [])
      .map((s) => s.path)
      .filter((path) => !this.isExisting(path));
  }

  get selectedCount(): number {
    return this.availablePaths.filter((path) => this.selectedPaths.has(path)).length;
  }

  get allSelected(): boolean {
    return this.availablePaths.length > 0 && this.selectedCount === this.availablePaths.length;
  }

  select(path: string, selected: boolean): void {
    if (selected) this.selectedPaths.add(path);
    else this.selectedPaths.delete(path);
  }

  selectAll(selected: boolean): void {
    this.selectedPaths = new Set(selected ? this.availablePaths : []);
  }

  openReview(): void {
    this.selectedPaths.clear();
    this.drawerOpen = true;
  }

  addSelected(): void {
    if (this.disabled) return;
    const paths = this.availablePaths.filter((path) => this.selectedPaths.has(path));
    if (!paths.length) return;
    this.pathsSelected.emit(paths);
    this.drawerOpen = false;
    this.selectedPaths.clear();
  }
}
