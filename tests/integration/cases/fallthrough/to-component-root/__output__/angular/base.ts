import { Component, input } from "@angular/core";

@Component({
  selector: "uf-base",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <button
      type="button"
      class="base"
      [class]="this.class()"
      [style]="this.style()"
    >{{ text }}</button>
  `,
})
export default class Base {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
