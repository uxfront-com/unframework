import { Component, input } from "@angular/core";

@Component({
  selector: "uf-stack",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let gap = this.gap();
    @let accent = this.accent();
    <ul
      class="stack"
      [style]="{ '--gap': gap, '--accent': accent, ...this.style() }"
      [class]="this.class()"
      data-uf-e3a22111=""
    >
      <li class="item" data-uf-e3a22111="">One</li>
      <li class="item" data-uf-e3a22111="">Two</li>
      <li class="item" data-uf-e3a22111="">Three</li>
    </ul>
  `,
})
export default class Stack {
  readonly gap = input.required<string>();
  readonly accent = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
