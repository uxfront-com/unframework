import { Badge } from "./badge";
import { Pill as Tag } from "./pill";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-status",
  imports: [Badge, Tag],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let state = this.state();
    <p class="status" [class]="this.class()" [style]="this.style()">
      <uf-badge [text]="'Build'" />
      <uf-pill [text]="state" />
    </p>
  `,
})
export default class Status {
  readonly state = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
