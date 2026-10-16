import Base from "./base";
import { Component, input } from "@angular/core";

@Component({
  selector: "uf-primary",
  imports: [Base],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <uf-base [text]="text" [class]="['primary', this.class()].join(' ')" [style]="this.style()" />
  `,
})
export default class Primary {
  readonly text = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
