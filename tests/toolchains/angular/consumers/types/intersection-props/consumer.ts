import { Component } from "@angular/core";

import Chip from "../../../../../integration/cases/types/intersection-props/__output__/angular/chip";

@Component({
  selector: "uf-chip-consumer",
  imports: [Chip],
  template: `<uf-chip [size]="'small'" [tone]="'accent'" [label]="'Draft'" />`,
})
export default class Consumer {}
