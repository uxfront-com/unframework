import { Component } from "@angular/core";

import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/angular/text-field";

@Component({
  selector: "uf-text-field-consumer",
  imports: [TextField],
  template: `
    <uf-text-field
      [name]="field.name"
      [label]="field.label"
      [placeholder]="'you@example.com'"
      [required]="true"
    />
  `,
})
export default class Consumer {
  protected readonly field: TextFieldProps = { name: "email", label: "Email" };
}
