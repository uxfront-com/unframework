import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, model, viewChild } from "@angular/core";

@Component({
  selector: "uf-price-range",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let min = this.min();
    @let max = this.max();
    <fieldset
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <legend>{{ label }}</legend>
      <p>From {{ min }} to {{ max }}</p>
      <button type="button" (click)="widen()">Widen</button>
    </fieldset>
  `,
})
export default class PriceRange {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly min = model<number>(0);
  readonly max = model<number>(100);
  readonly ufElement = viewChild<ElementRef<HTMLFieldSetElement>>("ufElement");

  protected widen() {
    this.min.update((min) => min - 10);
    this.max.update((max) => max + 10);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
