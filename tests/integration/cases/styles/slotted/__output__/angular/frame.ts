import { Component, input } from "@angular/core";

@Component({
  selector: "uf-frame",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <figure class="frame" [class]="this.class()" [style]="this.style()" data-uf-9dc516fd="">
      <ng-content />
    </figure>
  `,
})
export default class Frame {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
