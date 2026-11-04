import { Component } from "@angular/core";

import Palette, {
  type Tone,
} from "../../../../../integration/cases/types/shared-type/__output__/angular/palette";

@Component({
  selector: "uf-palette-consumer",
  imports: [Palette],
  template: `<uf-palette [tone]="tone" />`,
})
export default class Consumer {
  protected readonly tone: Tone = "accent";
}
