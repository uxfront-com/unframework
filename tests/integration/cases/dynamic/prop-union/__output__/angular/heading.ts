import { Component, input } from "@angular/core";

@Component({
  selector: "uf-heading",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let tag = this.tag();
    @let text = this.text();
    @switch (tag) {
      @case ("h1") {
        <h1 class="heading">{{ text }}</h1>
      } @case ("h2") {
        <h2 class="heading">{{ text }}</h2>
      } @case ("h3") {
        <h3 class="heading">{{ text }}</h3>
      }
    }
  `,
})
export default class Heading {
  readonly tag = input.required<"h1" | "h2" | "h3">();
  readonly text = input.required<string>();
}
