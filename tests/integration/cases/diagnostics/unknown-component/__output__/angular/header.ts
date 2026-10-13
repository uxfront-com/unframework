import { Component, input } from "@angular/core";

@Component({
  selector: "uf-header",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <header class="header" [class]="this.class()" [style]="this.style()">Site</header>
  `,
})
export class Header {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
