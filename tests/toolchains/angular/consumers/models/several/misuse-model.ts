import { Component, signal } from "@angular/core";

import PriceRange from "../../../../../integration/cases/models/several/__output__/angular/price-range";

@Component({
  selector: "uf-price-range-misuse-model",
  imports: [PriceRange],
  template: `
    <!-- @uf-expect TS2322 PriceRange.model:max -->
    <uf-price-range [label]="'Price'" [(max)]="high" />
  `,
})
export default class MisuseModel {
  protected readonly high = signal("fifty");
}
