import { Component, input } from "@angular/core";

@Component({
  selector: "uf-card-icon",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let symbol = this.symbol();
    <span
      class="icon"
      aria-hidden="true"
      [class]="this.class()"
      [style]="this.style()"
    >{{ symbol }}</span>
  `,
})
export class CardIcon {
  readonly symbol = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
