import { Component, input } from "@angular/core";

@Component({
  selector: "uf-badge",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let count = this.count();
    <span class="badge" [class]="this.class()" [style]="this.style()" data-uf-d9cef2e7="">
      <span class="label" data-uf-d9cef2e7="">{{ label }}</span>
      <span class="count" data-uf-d9cef2e7="">{{ count }}</span>
    </span>
  `,
})
export default class Badge {
  readonly label = input.required<string>();
  readonly count = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
