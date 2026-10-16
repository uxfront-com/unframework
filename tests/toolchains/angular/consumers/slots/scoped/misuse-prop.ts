import { Component } from "@angular/core";

import List from "../../../../../integration/cases/slots/scoped/__output__/angular/list";

@Component({
  selector: "uf-list-misuse-prop",
  imports: [List],
  template: `
    <!-- @uf-expect TS2322 List.prop:label -->
    <uf-list [items]="['a']" [label]="1" />
  `,
})
export default class MisuseProp {}
