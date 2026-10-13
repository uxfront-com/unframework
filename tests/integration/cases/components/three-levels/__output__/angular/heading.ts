import { Component, input } from "@angular/core";

@Component({
  selector: "uf-heading",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <h3 class="heading" [class]="this.class()" [style]="this.style()">{{ text }}</h3>
  `,
})
export default class Heading {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
