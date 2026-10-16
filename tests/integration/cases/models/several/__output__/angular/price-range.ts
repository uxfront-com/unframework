import { Component, input, model } from "@angular/core";

@Component({
  selector: "uf-price-range",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let min = this.min();
    @let max = this.max();
    <fieldset [class]="this.class()" [style]="this.style()">
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
  readonly min = model<number>(0);
  readonly max = model<number>(100);

  protected widen() {
    this.min.update((min) => min - 10);
    this.max.update((max) => max + 10);
  }
}
