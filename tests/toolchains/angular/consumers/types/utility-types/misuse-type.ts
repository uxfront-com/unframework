import { Component } from "@angular/core";

import TextField, {
  type TextFieldProps,
} from "../../../../../integration/cases/types/utility-types/__output__/angular/text-field";

@Component({
  selector: "uf-text-field-misuse-type",
  imports: [TextField],
  template: `<uf-text-field [name]="field.name" [label]="'Email'" />`,
})
export default class MisuseType {
  // @uf-expect TS2322 TextField.type:TextFieldProps
  protected readonly field: TextFieldProps = { name: "email", label: 1 };
}
