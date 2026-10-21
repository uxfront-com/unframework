import { Component, input } from "@angular/core";

@Component({
  selector: "uf-panel",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <aside class="panel" [class]="this.class()" [style]="this.style()" data-uf-48dda3f4="">
      <p class="text" data-uf-48dda3f4="">{{ text }}</p>
    </aside>
  `,
})
export default class Panel {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
