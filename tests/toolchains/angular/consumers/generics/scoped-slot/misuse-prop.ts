import { Component } from "@angular/core";

import Picker from "../../../../../integration/cases/generics/scoped-slot/__output__/angular/picker";

@Component({
  selector: "uf-picker-misuse-prop",
  imports: [Picker],
  template: `
    <!-- @uf-expect TS2322 Picker.prop:items -->
    <uf-picker [items]="1" />
  `,
})
export default class MisuseProp {}
