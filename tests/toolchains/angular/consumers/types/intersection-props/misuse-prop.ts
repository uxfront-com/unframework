import { Component } from "@angular/core";

import Chip from "../../../../../integration/cases/types/intersection-props/__output__/angular/chip";

@Component({
  selector: "uf-chip-misuse-prop",
  imports: [Chip],
  template: `
    <!-- @uf-expect TS2322 Chip.prop:size -->
    <uf-chip [size]="'medium'" [label]="'Draft'" />
  `,
})
export default class MisuseProp {}
