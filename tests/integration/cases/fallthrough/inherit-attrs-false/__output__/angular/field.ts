import { Component, input } from "@angular/core";

@Component({
  selector: "uf-field",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <label class="field">{{ label }}&ngsp;<input [attr.name]="label.toLowerCase()" /></label>
  `,
})
export default class Field {
  readonly label = input.required<string>();
}
