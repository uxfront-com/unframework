import Primary from "./primary";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-toolbar",
  imports: [Primary],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div role="toolbar" aria-label="Actions" [class]="this.class()" [style]="this.style()">
      <uf-primary [text]="'Save'" [class]="'wide'" />
    </div>
  `,
})
export default class Toolbar {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
