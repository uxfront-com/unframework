import { Component, input } from "@angular/core";

@Component({
  selector: "uf-badge",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <span class="badge">{{ text }}</span>
  `,
})
export class Badge {
  readonly text = input.required<string>();
}
