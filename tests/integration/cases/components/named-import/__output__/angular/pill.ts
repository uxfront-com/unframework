import { Component, input } from "@angular/core";

@Component({
  selector: "uf-pill",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <span class="pill">{{ text }}</span>
  `,
})
export class Pill {
  readonly text = input.required<string>();
}
