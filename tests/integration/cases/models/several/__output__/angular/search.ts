import PriceRange from "./price-range";
import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-search",
  imports: [PriceRange],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let low = this.low();
    @let high = this.high();
    <section aria-label="Search" [class]="this.class()" [style]="this.style()">
      <uf-price-range [label]="'Price'" [(min)]="this.low" [(max)]="this.high" />
      <output>Between {{ low }} and {{ high }}</output>
      <button type="button" (click)="onCheaper()">Cheaper</button>
    </section>
  `,
})
export default class Search {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly low = signal(20);
  protected readonly high = signal(50);

  protected onCheaper() {
    this.high.set(40);
  }
}
