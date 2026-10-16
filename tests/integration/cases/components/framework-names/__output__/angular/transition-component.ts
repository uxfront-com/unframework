import { Component, input } from "@angular/core";

@Component({
  selector: "uf-transition-component",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <p class="note" [class]="this.class()" [style]="this.style()">Plain child</p>
  `,
})
export default class TransitionComponent {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
