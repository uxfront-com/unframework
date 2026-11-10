import { Component } from "@angular/core";

import Badge from "../../../../../integration/cases/types/imported-interface/__output__/angular/badge";

@Component({
  selector: "uf-badge-consumer",
  imports: [Badge],
  template: `<uf-badge [label]="'New'" [tone]="'danger'" />`,
})
export default class Consumer {}
