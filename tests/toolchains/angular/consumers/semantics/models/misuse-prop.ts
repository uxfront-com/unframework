import { Component } from "@angular/core";

import Disclosure from "../../../../../integration/cases/semantics/models/__output__/angular/disclosure";

@Component({
  selector: "uf-disclosure-misuse-prop",
  imports: [Disclosure],
  template: `
    <!-- @uf-expect TS2322 Disclosure.prop:title -->
    <uf-disclosure [title]="true" />
  `,
})
export default class MisuseProp {}
