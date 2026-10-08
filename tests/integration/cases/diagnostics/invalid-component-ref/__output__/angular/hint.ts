import { Component, input } from "@angular/core";

@Component({
  selector: "uf-hint",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <small class="hint">{{ text }}</small>
  `,
})
export class Hint {
  readonly text = input.required<string>();
}
