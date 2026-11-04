import { Component } from "@angular/core";

import Palette, {
  type Tone,
} from "../../../../../integration/cases/types/shared-type/__output__/angular/palette";

@Component({
  selector: "uf-palette-misuse-type",
  imports: [Palette],
  template: `<uf-palette [tone]="tone" />`,
})
export default class MisuseType {
  // @uf-expect TS2322 Palette.type:Tone
  protected readonly tone: Tone = "loud";
}
