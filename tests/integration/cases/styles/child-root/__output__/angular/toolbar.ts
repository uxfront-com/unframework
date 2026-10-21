import Button from "./button";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-toolbar",
  imports: [Button],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      role="toolbar"
      aria-label="Actions"
      class="toolbar"
      [class]="this.class()"
      [style]="this.style()"
      data-uf-a33d603f=""
    >
      <uf-button [text]="'Save'" data-uf-a33d603f="" />
      <uf-button [text]="'Cancel'" data-uf-a33d603f="" />
    </div>
  `,
})
export default class Toolbar {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
