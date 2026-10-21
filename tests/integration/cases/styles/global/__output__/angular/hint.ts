import { Component, input } from "@angular/core";

@Component({
  selector: "uf-hint",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <p
      class="hint"
      [class]="this.class()"
      [style]="this.style()"
    >Tip: <span class="uf-highlight">{{ text }}</span></p>
  `,
})
export default class Hint {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
