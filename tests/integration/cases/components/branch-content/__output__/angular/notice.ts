import { Component, input } from "@angular/core";

@Component({
  selector: "uf-notice",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    @let tone = this.tone();
    <p
      role="status"
      class="notice"
      [class]="[tone, this.class()].join(' ')"
      [style]="this.style()"
    >{{ text }}</p>
  `,
})
export default class Notice {
  readonly text = input.required<string>();
  readonly tone = input.required<"info" | "quiet">();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
