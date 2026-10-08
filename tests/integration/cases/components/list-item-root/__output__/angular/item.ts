import { Component, input } from "@angular/core";

@Component({
  selector: "uf-item",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <li class="item">{{ label }}</li>
  `,
})
export default class Item {
  readonly label = input.required<string>();
}
