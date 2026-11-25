import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, InjectionToken, inject, input, viewChild } from "@angular/core";

export interface FieldProps {
  label: string;
  hint: string;
}

const idCounter = new InjectionToken<{ next: number }>("idCounter", {
  factory: () => ({ next: 0 }),
});

@Component({
  selector: "uf-field",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let hint = this.hint();
    <p
      class="field"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label [attr.for]="inputId">{{ label }}</label>
      <input [attr.id]="inputId" type="text" [attr.aria-describedby]="hintId" />
      <small [attr.id]="hintId">{{ hint }}</small>
    </p>
  `,
})
export default class Field {
  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  protected readonly inputId = `uf-id-field-${inject(idCounter).next++}`;
  protected readonly hintId = `uf-id-field-${inject(idCounter).next++}`;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
