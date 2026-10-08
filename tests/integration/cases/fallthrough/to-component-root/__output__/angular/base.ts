import { Component, input } from "@angular/core";

@Component({
  selector: "uf-base",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let text = this.text();
    <button type="button" class="base">{{ text }}</button>
  `,
})
export default class Base {
  readonly text = input.required<string>();
}
