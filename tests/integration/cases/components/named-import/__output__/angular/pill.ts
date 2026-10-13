import { Component, input } from "@angular/core";

@Component({
  selector: "uf-pill",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <span class="pill" [class]="this.class()" [style]="this.style()">{{ text }}</span>
  `,
})
export class Pill {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
