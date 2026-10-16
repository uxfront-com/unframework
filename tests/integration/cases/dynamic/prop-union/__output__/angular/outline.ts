import Heading from "./heading";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-outline",
  imports: [Heading],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <main [class]="this.class()" [style]="this.style()">
      <uf-heading [tag]="'h1'" [text]="'Guide'" />
      <uf-heading [tag]="'h2'" [text]="'Setup'" />
      <uf-heading [tag]="'h3'" [text]="'Requirements'" />
    </main>
  `,
})
export default class Outline {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
