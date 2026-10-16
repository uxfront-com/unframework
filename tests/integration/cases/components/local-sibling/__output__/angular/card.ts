import { CardIcon } from "./card-icon";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-card",
  imports: [CardIcon],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <div class="card" [class]="this.class()" [style]="this.style()">
      <uf-card-icon [symbol]="'+'" />
      <h3>{{ title }}</h3>
      <uf-card-icon [symbol]="'-'" />
    </div>
  `,
})
export default class Card {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
