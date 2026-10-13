import { Component, input } from "@angular/core";

@Component({
  selector: "uf-tag",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <span
      class="tag"
      [style]="{ padding: '2px 6px', color: 'rgb(30, 30, 30)', ...this.style() }"
      [class]="this.class()"
    >{{ label }}</span>
  `,
})
export default class Tag {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
