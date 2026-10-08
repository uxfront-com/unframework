import { Component, input } from "@angular/core";

@Component({
  selector: "uf-transition",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let step = this.step();
    <p class="step">Step: {{ step }}</p>
  `,
})
export default class Transition {
  readonly step = input.required<string>();
}
