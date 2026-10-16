import { Component, signal } from "@angular/core";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/angular/disclosure";

@Component({
  selector: "uf-disclosure-misuse-model",
  imports: [Disclosure],
  template: `
    <!-- @uf-expect TS2322 Disclosure.model:open -->
    <uf-disclosure [title]="'Shipping'" [(open)]="shipping" />
  `,
})
export default class MisuseModel {
  protected readonly shipping = signal("yes");
}
