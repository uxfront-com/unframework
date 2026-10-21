import { Component, input } from "@angular/core";

@Component({
  selector: "uf-continue",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <button
      type="button"
      class="continue"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-bb3adc28=""
    >{{ text }}</button>
  `,
})
export default class Continue {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
