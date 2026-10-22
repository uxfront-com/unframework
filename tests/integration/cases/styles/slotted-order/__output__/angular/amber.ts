import { Component, input } from "@angular/core";

@Component({
  selector: "uf-amber",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="amber" [class]="this.class()" [style]="this.style()" data-uf-c97301b3="">
      <ng-content />
    </div>
  `,
})
export default class Amber {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
