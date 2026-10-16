import { Component, input } from "@angular/core";

@Component({
  selector: "uf-card",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <div class="card" [class]="this.class()" [style]="this.style()">
      <strong>{{ label }}</strong>
    </div>
  `,
})
export default class Card {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
