import { Component, signal } from "@angular/core";

import PriceRange from "../../../../../integration/cases/models/several/__output__/angular/price-range";

@Component({
  selector: "uf-price-range-consumer",
  imports: [PriceRange],
  template: `<uf-price-range [label]="'Price'" [(min)]="low" [(max)]="high" />`,
})
export default class Consumer {
  protected readonly low = signal(20);
  protected readonly high = signal(50);
}
