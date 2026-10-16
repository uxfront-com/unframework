import Item from "./item";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-menu",
  imports: [Item],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let entries = this.entries();
    <ul aria-label="Menu" [class]="this.class()" [style]="this.style()">
      @for (entry of entries; track entry) {
        <uf-item [label]="entry" />
      }
    </ul>
  `,
})
export default class Menu {
  readonly entries = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
