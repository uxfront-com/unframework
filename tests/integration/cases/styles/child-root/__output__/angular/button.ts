import { Component, input } from "@angular/core";

@Component({
  selector: "uf-button",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <button
      type="button"
      class="button"
      [class]="this.class()"
      [style]="this.style()"
    ><span class="icon" aria-hidden="true">+</span>{{ text }}</button>
  `,
})
export default class Button {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
