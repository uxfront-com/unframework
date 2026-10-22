import { Component, input } from "@angular/core";

@Component({
  selector: "uf-mat",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="mat" [class]="this.class()" [style]="this.style()" data-uf-09929c4a="">
      <ng-content />
    </div>
  `,
})
export default class Mat {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
