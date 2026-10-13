import { Component, signal } from "@angular/core";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/angular/disclosure";

@Component({
  selector: "uf-disclosure-consumer",
  imports: [Disclosure],
  template: `<uf-disclosure [title]="'Shipping'" [(open)]="shipping" />`,
})
export default class Consumer {
  protected readonly shipping = signal(true);
}
