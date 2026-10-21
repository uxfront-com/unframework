import { Component, input } from "@angular/core";

@Component({
  selector: "uf-action",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <button
      type="button"
      class="action"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-6173c12c=""
    >{{ text }}</button>
  `,
})
export default class Action {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
