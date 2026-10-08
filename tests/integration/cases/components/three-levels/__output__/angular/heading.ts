import { Component, input } from "@angular/core";

@Component({
  selector: "uf-heading",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <h3 class="heading">{{ text }}</h3>
  `,
})
export default class Heading {
  readonly text = input.required<string>();
}
