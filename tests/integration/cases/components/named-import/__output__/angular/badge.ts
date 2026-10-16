import { Component, input } from "@angular/core";

@Component({
  selector: "uf-badge",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <span class="badge" [class]="this.class()" [style]="this.style()">{{ text }}</span>
  `,
})
export class Badge {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
