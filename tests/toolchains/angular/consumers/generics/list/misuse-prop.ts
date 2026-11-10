import { Component } from "@angular/core";

import List from "../../../../../integration/cases/generics/list/__output__/angular/list";

@Component({
  selector: "uf-list-misuse-prop",
  imports: [List],
  template: `
    <!-- @uf-expect TS2322 List.prop:selected -->
    <uf-list [label]="'Numbers'" [items]="[1, 2]" [selected]="'two'" />
  `,
})
export default class MisuseProp {}
