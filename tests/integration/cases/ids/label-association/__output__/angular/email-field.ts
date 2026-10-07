import { Component, input } from "@angular/core";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

let nextId = 0;

@Component({
  selector: "uf-email-field",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let hint = this.hint();
    <div class="email-field">
      <label [attr.for]="inputId">{{ label }}</label>
      <input [attr.id]="inputId" name="email" type="email" [attr.aria-describedby]="hintId" />
      <p [attr.id]="hintId">{{ hint }}</p>
    </div>
  `,
})
export default class EmailField {
  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  protected readonly inputId = `uf-id-email-field-${nextId++}`;
  protected readonly hintId = `uf-id-email-field-${nextId++}`;
}
