import { Component, input } from "@angular/core";

@Component({
  selector: "uf-chip",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <span class="chip" [class]="this.class()" [style]="this.style()">{{ label }}</span>
  `,
})
export default class Chip {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
