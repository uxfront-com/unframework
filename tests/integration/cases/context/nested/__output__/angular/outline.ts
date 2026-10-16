import Level from "./level";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-outline",
  imports: [Level],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <uf-level [title]="'Book'" [class]="this.class()" [style]="this.style()">
      <uf-level [title]="'Part'">
        <uf-level [title]="'Chapter'" />
      </uf-level>
      <uf-level [title]="'Appendix'" />
    </uf-level>
  `,
})
export default class Outline {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
