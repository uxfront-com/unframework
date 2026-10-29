import { Component } from "@angular/core";

import Palette from "../../../../../integration/cases/types/shared-type/__output__/angular/palette";

@Component({
  selector: "uf-palette-misuse-prop",
  imports: [Palette],
  template: `
    <!-- @uf-expect TS2322 Palette.prop:tone -->
    <uf-palette [tone]="'loud'" />
  `,
})
export default class MisuseProp {}
