import Frame, { FrameTitle } from "./frame";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-gallery",
  imports: [Frame, FrameTitle],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div [class]="this.class()" [style]="this.style()">
      <uf-frame [label]="'Card'" [wide]="false">
        <ng-template ufFrameTitle>Sunset</ng-template>
      </uf-frame>
      <uf-frame [label]="'Panel'" [wide]="true">
        <ng-template ufFrameTitle>Dawn</ng-template>
      </uf-frame>
      <uf-frame [label]="'Empty'" [wide]="true" />
    </div>
  `,
})
export default class Gallery {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
