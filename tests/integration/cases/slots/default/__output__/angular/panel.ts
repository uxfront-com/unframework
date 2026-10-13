import { Component, input } from "@angular/core";

@Component({
  selector: "uf-panel",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    <section class="panel" [attr.aria-label]="title" [class]="this.class()" [style]="this.style()">
      <h2>{{ title }}</h2>
      <ng-content />
    </section>
  `,
})
export default class Panel {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
