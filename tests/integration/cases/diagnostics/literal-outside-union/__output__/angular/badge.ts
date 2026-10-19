import { Component, input } from "@angular/core";

@Component({
  selector: "uf-badge",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let tone = this.tone();
    <span
      class="badge"
      [class]="[tone, this.class()].join(' ')"
      [style]="this.style()"
    >{{ tone }}</span>
  `,
})
export class Badge {
  readonly tone = input.required<"info" | "warning">();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
