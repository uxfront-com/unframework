import { Component, input } from "@angular/core";

@Component({
  selector: "uf-field",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <label>{{ label }}&ngsp;<input type="text" /></label>
  `,
})
export class Field {
  readonly label = input.required<string>();
}
