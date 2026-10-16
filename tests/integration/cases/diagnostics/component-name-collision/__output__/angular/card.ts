import { Component, input } from "@angular/core";

@Component({
  selector: "uf-card",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <p [class]="this.class()" [style]="this.style()">Card</p>
  `,
})
export class Card {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
