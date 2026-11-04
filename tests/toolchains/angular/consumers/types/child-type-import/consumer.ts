import { Component } from "@angular/core";

import type { FieldProps } from "../../../../../integration/cases/types/child-type-import/__output__/angular/field";
import Form from "../../../../../integration/cases/types/child-type-import/__output__/angular/form";

@Component({
  selector: "uf-form-consumer",
  imports: [Form],
  template: `<uf-form [field]="field" />`,
})
export default class Consumer {
  protected readonly field: FieldProps = { name: "email", label: "Email" };
}
