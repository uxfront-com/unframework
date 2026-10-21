import { Component, input } from "@angular/core";

@Component({
  selector: "uf-card",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <section class="card" [class]="this.class()" [style]="this.style()" data-uf-bb60e985="">
      <h2 class="title" data-uf-bb60e985="">{{ title }}</h2>
    </section>
  `,
})
export default class Card {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
