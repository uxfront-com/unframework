import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface UploadStep {
  id: string;
  label: string;
}

export interface UploadStatusProps {
  fileName: string;
  state: "queued" | "uploading" | "failed";
  percent: number;
  steps: UploadStep[];
  error?: string;
}

@Component({
  selector: "uf-upload-status",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let fileName = this.fileName();
    @let state = this.state();
    @let percent = this.percent();
    @let steps = this.steps();
    @let error = this.error();
    <section
      class="upload"
      [class]="['upload-' + state, this.class()].join(' ')"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : 'Upload of ' + fileName"
      [style]="{ color: state === 'failed' ? '#8a1c1c' : '#1f3d5c', '--upload-percent': percent, ...this.style() }"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ fileName }}</h2>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent"
      >{{ percent }}%</div>
      @if (state === "failed") {
        <p class="upload-error">{{ error ?? "The upload failed." }}</p>
      } @else {
        <p>{{ state === "queued" ? "Waiting to start" : "Uploading" }}</p>
      }
      <ol>
        @for (step of steps; track step.id) {
          <li>{{ step.label }}</li>
        }
      </ol>
    </section>
  `,
})
export default class UploadStatus {
  readonly fileName = input.required<string>();
  readonly state = input.required<"queued" | "uploading" | "failed">();
  readonly percent = input.required<number>();
  readonly steps = input.required<UploadStep[]>();
  readonly error = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
