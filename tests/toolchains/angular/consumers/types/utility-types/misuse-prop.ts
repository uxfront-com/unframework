import { Component } from "@angular/core";

import TextField from "../../../../../integration/cases/types/utility-types/__output__/angular/text-field";

@Component({
  selector: "uf-text-field-misuse-prop",
  imports: [TextField],
  template: `
    <!-- @uf-expect TS2322 TextField.prop:placeholder -->
    <uf-text-field [name]="'email'" [label]="'Email'" [placeholder]="1" />
  `,
})
export default class MisuseProp {}
