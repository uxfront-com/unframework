import { Component } from "@angular/core";

import Form from "../../../../../integration/cases/types/child-type-import/__output__/angular/form";

@Component({
  selector: "uf-form-misuse-prop",
  imports: [Form],
  template: `
    <!-- @uf-expect TS2741 Form.prop:field -->
    <uf-form [field]="{ name: 'email' }" />
  `,
})
export default class MisuseProp {}
