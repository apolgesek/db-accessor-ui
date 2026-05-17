import { AfterViewInit, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import JSONEditor, { JSONEditorOptions } from 'jsoneditor';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBreadCrumbModule } from 'ng-zorro-antd/breadcrumb';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTypographyModule } from 'ng-zorro-antd/typography';
import { finalize, switchMap } from 'rxjs';
import { SpinnerService } from '../../../core';
import { EntityRequest } from '../../../core/models';
import { ItemResponse, RecordHttp } from '../services/record-http';
import { RequestHttp } from '../services/request-http';

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  while (base64.length % 4) {
    base64 += '=';
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

@Component({
  selector: 'app-record',
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
    NzIconModule,
    FormsModule,
    NzListModule,
    NzTypographyModule,
    NzBreadCrumbModule,
    RouterLink,
  ],
  templateUrl: './record.html',
  styleUrl: './record.scss',
})
export class Record implements OnInit, AfterViewInit {
  isLoading = false;
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(NzMessageService);
  private readonly spinnerService = inject(SpinnerService);
  private readonly requestHttp = inject(RequestHttp);
  private readonly recordHttp = inject(RecordHttp);
  private readonly route = inject(ActivatedRoute);
  record: ItemResponse<unknown> = this.route.snapshot.data['record'] as ItemResponse<unknown>;
  selectedRedactedElements: string[] = [];
  test: string | null = null;
  selectAll = false;
  redactedValues = new Set<string>();

  @ViewChild('viewer') private readonly jsonViewer!: ElementRef;
  @ViewChild('editor') private readonly jsonEditor!: ElementRef;
  private viewer!: JSONEditor;
  private editor!: JSONEditor;

  form = this.fb.group({
    userName: this.fb.control<string | null>(null, [Validators.required]),
    table: this.fb.control<string | null>(null, [Validators.required]),
    partitionKey: this.fb.control<string | null>(null, [Validators.required]),
    duration: this.fb.control<number | null>(null, [Validators.required]),
    agree: this.fb.control<boolean | null>(null, [Validators.requiredTrue]),
  });

  get request(): EntityRequest {
    return this.record.request;
  }

  get paths(): string[] {
    return this.request.unredactRequests?.flatMap((r) => r.paths) ?? [];
  }

  get id(): string {
    const id = this.route.snapshot.paramMap.get('id');

    return id ? base64urlDecode(id).split('#')[2] : '';
  }

  onSelectAllChange() {
    if (this.selectAll) {
      this.selectedRedactedElements = Array.from(this.redactedValues);
    }
    this.viewer.refresh();
  }

  ngOnInit(): void {
    this.setPaths(this.record);
  }

  private setPaths(record: ItemResponse<unknown>) {
    this.redactedValues = new Set(record.maskRuleset);
    this.selectedRedactedElements = [];
  }

  ngAfterViewInit(): void {
    const options: JSONEditorOptions = {
      mode: 'view',
      sortObjectKeys: true,
      onClassName: (node) => {
        const classNames = [];
        if (node.value === '<redacted>') {
          classNames.push('redacted');
        }

        if (this.selectedRedactedElements.includes(this.pathToPattern(node.path))) {
          classNames.push('selected');
        }

        return classNames.join(' ');
      },
      onEvent: (node, event) => {
        if (event.type === 'mouseover') {
          if (node.value === '<redacted>') {
            if (this.selectedRedactedElements.includes(this.pathToPattern(node.path))) {
              return;
            }
          }
        } else if (event.type === 'click' && node.value === '<redacted>') {
          if (this.selectedRedactedElements.includes(this.pathToPattern(node.path))) {
            this.selectedRedactedElements = this.selectedRedactedElements.filter(
              (p) => p !== this.pathToPattern(node.path),
            );
          } else {
            this.selectedRedactedElements.push(this.pathToPattern(node.path));
          }

          (event.target as HTMLElement).style.backgroundColor = '';
          this.viewer.refresh();
        }
      },
    };

    this.viewer = new JSONEditor(this.jsonViewer.nativeElement, options);
    this.viewer.set(this.record.item);
  }

  pathToPattern(path: readonly (string | number)[]): string {
    const out: string[] = [];

    for (const seg of path) {
      const isIndex = typeof seg === 'number';

      if (isIndex) {
        // attach [] to the previous segment (e.g., addresses -> addresses[])
        if (out.length === 0) {
          // path starts with an index; represent it as [] as a standalone (rare)
          out.push('[]');
        } else {
          out[out.length - 1] = `${out[out.length - 1]}[]`;
        }
      } else {
        out.push(seg);
      }
    }

    return out.join('.');
  }

  unredact() {
    this.spinnerService.setIsLoading(true);
    this.requestHttp
      .unredact(
        this.route.snapshot.paramMap.get('id') ?? '',
        'User requested unredaction',
        this.selectedRedactedElements,
      )
      .pipe(
        switchMap(() => {
          this.messageService.success('Unredaction successful');
          return this.recordHttp.getRecord(this.route.snapshot.paramMap.get('id') ?? '');
        }),
        finalize(() => {
          this.spinnerService.setIsLoading(false);
        }),
      )
      .subscribe((record) => {
        this.record = record;
        this.setPaths(record);
        this.viewer.set(record.item);
      });
  }

  removePath(path: string) {
    this.selectedRedactedElements = this.selectedRedactedElements.filter((p) => p !== path);
    this.selectAll = false;
    this.viewer.refresh();
  }
}
