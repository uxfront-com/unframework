import { Component, input } from "@angular/core";

@Component({
  selector: "uf-chip",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <span class="chip">{{ label }}</span>
  `,
})
export default class Chip {
  readonly label = input.required<string>();
}
