import { Component, input } from "@angular/core";

interface FieldAttributes {
  name: string;
  placeholder?: string;
  autocomplete?: string;
  maxlength?: number;
  required?: boolean;
  title?: string;
}

interface HintAttributes {
  id: string;
  title?: string;
}

export interface TextFieldProps {
  label: string;
  inputId: string;
  hintText: string;
  field: FieldAttributes;
  hint?: HintAttributes;
}

@Component({
  selector: "uf-text-field",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let inputId = this.inputId();
    @let hintText = this.hintText();
    @let field = this.field();
    @let hint = this.hint();
    <div class="text-field">
      <label [attr.for]="inputId">{{ label }}</label>
      <input
        [attr.id]="inputId"
        type="text"
        [attr.name]="field.name"
        [attr.placeholder]="field.placeholder"
        [attr.autocomplete]="field.autocomplete"
        [attr.maxlength]="field.maxlength"
        [attr.required]="field.required ? '' : null"
        [attr.title]="field.title"
      />
      <p class="text-field-hint" [attr.id]="hint?.id" [attr.title]="hint?.title">{{ hintText }}</p>
    </div>
  `,
})
export default class TextField {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly hintText = input.required<string>();
  readonly field = input.required<FieldAttributes>();
  readonly hint = input<HintAttributes>();
}
