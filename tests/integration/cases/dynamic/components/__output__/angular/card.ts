import { Component, input } from "@angular/core";

@Component({
  selector: "uf-card",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <div class="card">
      <strong>{{ label }}</strong>
    </div>
  `,
})
export default class Card {
  readonly label = input.required<string>();
}
