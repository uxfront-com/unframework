import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

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

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-upload-status",
  imports: [ScopeAttributes],
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
      [attr.aria-label]="'Upload of ' + fileName"
      [style]="{ color: state === 'failed' ? '#8a1c1c' : '#1f3d5c', '--upload-percent': percent, ...this.style() }"
      [ufScope]="this.host"
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
