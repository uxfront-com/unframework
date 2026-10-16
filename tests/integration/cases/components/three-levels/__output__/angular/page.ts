import Section from "./section";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-page",
  imports: [Section],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    <article aria-label="Profile" [class]="this.class()" [style]="this.style()">
      <uf-section [title]="'About ' + name" [body]="'Three components deep.'" />
      <uf-section [title]="'Contact'" [body]="'Write to ' + name + '.'" />
    </article>
  `,
})
export default class Page {
  readonly name = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
