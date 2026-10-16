import { Component } from "@angular/core";

import Names from "../../../../../integration/cases/slots/scoped-default/__output__/angular/names";

@Component({
  selector: "uf-names-misuse-prop",
  imports: [Names],
  template: `
    <!-- @uf-expect TS2322 Names.prop:names -->
    <uf-names [names]="'Ada'" />
  `,
})
export default class MisuseProp {}
