import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  InjectionToken,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";

export interface ConfirmDialogProps {
  title: string;
}

const idCounter = new InjectionToken<{ next: number }>("idCounter", {
  factory: () => ({ next: 0 }),
});

@Component({
  selector: "uf-confirm-dialog",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <div
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="'aria-labelledby' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-labelledby'] : titleId"
      tabindex="-1"
      class="dialog"
      (keydown)="onKeydown($event)"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2 [attr.id]="titleId">{{ title }}</h2>
      <button type="button" #cancel (click)="ufClose.emit()">Cancel</button>
      <button type="button" (click)="confirm.emit()">Delete</button>
    </div>
  `,
})
export default class ConfirmDialog {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly confirm = output<void>();
  readonly ufClose = output<void>();
  private readonly cancel = viewChild<ElementRef<HTMLButtonElement>>("cancel");
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly titleId = `uf-id-confirm-dialog-${inject(idCounter).next++}`;

  constructor() {
    afterNextRender(() => {
      this.cancel()?.nativeElement.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.ufClose.emit();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
