import { Component } from "@angular/core";

import List from "../../../../../integration/cases/generics/list/__output__/angular/list";

@Component({
  selector: "uf-list-consumer",
  imports: [List],
  template: `<uf-list [label]="'Numbers'" [items]="[1, 2]" [selected]="2" />`,
})
export default class Consumer {}
