import { Component } from "@angular/core";

import Field, {
  type FieldProps,
} from "../../../../../integration/cases/types/child-type-import/__output__/angular/field";

@Component({
  selector: "uf-field-misuse-type",
  imports: [Field],
  template: `<uf-field [name]="'email'" [label]="field.label" />`,
})
export default class MisuseType {
  // @uf-expect TS2322 Field.type:FieldProps
  protected readonly field: FieldProps = { name: 1, label: "Email" };
}
