import Names, { NamesDefault } from "./names";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-roster",
  imports: [Names, NamesDefault],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let names = this.names();
    <uf-names [names]="names" [class]="this.class()" [style]="this.style()">
      <ng-template ufNamesDefault let-item="item">
        <b>{{ item }}!</b>
      </ng-template>
    </uf-names>
  `,
})
export default class Roster {
  readonly names = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
