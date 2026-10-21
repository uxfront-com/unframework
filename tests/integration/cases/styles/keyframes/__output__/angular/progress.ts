import { Component, input } from "@angular/core";

@Component({
  selector: "uf-progress",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <div class="progress" [class]="this.class()" [style]="this.style()" data-uf-0738d8af="">
      <span class="dot" data-uf-0738d8af=""></span>
      <span data-uf-0738d8af="">{{ label }}</span>
    </div>
  `,
})
export default class Progress {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
