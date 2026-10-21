import { Component, input } from "@angular/core";

@Component({
  selector: "uf-heading",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let big = this.big();
    @let text = this.text();
    @switch (big ? "h2" : "h3") {
      @case ("h2") {
        <h2 class="heading">{{ text }}</h2>
      } @case ("h3") {
        <h3 class="heading">{{ text }}</h3>
      }
    }
  `,
})
export default class Heading {
  readonly big = input.required<boolean>();
  readonly text = input.required<string>();
}
