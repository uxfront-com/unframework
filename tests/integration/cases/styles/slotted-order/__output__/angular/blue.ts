import { Component, input } from "@angular/core";

@Component({
  selector: "uf-blue",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="blue" [class]="this.class()" [style]="this.style()" data-uf-721c504a="">
      <ng-content />
    </div>
  `,
})
export default class Blue {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
