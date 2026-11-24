import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, ViewEncapsulation, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-chip",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let variant = this.variant();
    @let pressed = this.pressed();
    <button
      type="button"
      class="chip"
      [attr.data-variant]="'data-variant' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-variant'] : variant"
      [attr.data-state]="'data-state' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-state'] : pressed ? 'on' : 'off'"
      [attr.aria-pressed]="'aria-pressed' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-pressed'] : pressed ? 'true' : 'false'"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      data-uf-69db3802=""
      [ufScope]="this.host"
      #ufElement
    >{{ label }}</button>
  `,
  styleUrl: "./Chip.uf.tsx.css",
  encapsulation: ViewEncapsulation.None,
})
export default class Chip {
  readonly label = input.required<string>();
  readonly variant = input<"neutral" | "danger", "neutral" | "danger" | undefined>("neutral", {
    transform: (value) => (value === undefined ? "neutral" : value),
  });
  readonly pressed = input<boolean, boolean | undefined>(false, {
    transform: (value) => (value === undefined ? false : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLButtonElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
