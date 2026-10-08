import { Component, input } from "@angular/core";

@Component({
  selector: "uf-tag",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <span class="tag" style="padding: 2px 6px; color: rgb(30, 30, 30)">{{ label }}</span>
  `,
})
export default class Tag {
  readonly label = input.required<string>();
}
