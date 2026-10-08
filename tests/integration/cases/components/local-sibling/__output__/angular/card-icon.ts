import { Component, input } from "@angular/core";

@Component({
  selector: "uf-card-icon",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let symbol = this.symbol();
    <span class="icon" aria-hidden="true">{{ symbol }}</span>
  `,
})
export class CardIcon {
  readonly symbol = input.required<string>();
}
