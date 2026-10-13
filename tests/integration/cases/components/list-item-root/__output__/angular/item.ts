import { Component, input } from "@angular/core";

@Component({
  selector: "uf-item",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <li class="item" [class]="this.class()" [style]="this.style()">{{ label }}</li>
  `,
})
export default class Item {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
