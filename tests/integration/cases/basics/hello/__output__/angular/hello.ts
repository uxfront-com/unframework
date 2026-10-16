import { Component, input } from "@angular/core";

@Component({
  selector: "uf-hello",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <p class="greeting" [class]="this.class()" [style]="this.style()">Hello, world!</p>
  `,
})
export default class Hello {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
