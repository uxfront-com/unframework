import { Component } from "@angular/core";

import PriceRange from "../../../../../integration/cases/models/several/__output__/angular/price-range";

@Component({
  selector: "uf-price-range-misuse-prop",
  imports: [PriceRange],
  template: `
    <!-- @uf-expect TS2322 PriceRange.prop:label -->
    <uf-price-range [label]="1" />
  `,
})
export default class MisuseProp {}
