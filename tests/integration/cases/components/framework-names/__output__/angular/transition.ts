import { Component, input } from "@angular/core";

@Component({
  selector: "uf-transition",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let step = this.step();
    <p class="step" [class]="this.class()" [style]="this.style()">Step: {{ step }}</p>
  `,
})
export default class Transition {
  readonly step = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
