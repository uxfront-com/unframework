import { Component, ElementRef, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-field",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <label
      class="field"
      #ufElement
    >{{ label }}&ngsp;<input [attr.name]="label.toLowerCase()" /></label>
  `,
})
export default class Field {
  readonly label = input.required<string>();
  readonly ufElement = viewChild<ElementRef<HTMLLabelElement>>("ufElement");
}
