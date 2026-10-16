import { Component } from "@angular/core";

import Table from "../../../../../integration/cases/slots/prop-names/__output__/angular/table";

@Component({
  selector: "uf-table-misuse-prop",
  imports: [Table],
  template: `
    <!-- @uf-expect TS2322 Table.prop:people -->
    <uf-table [people]="'Ada'" />
  `,
})
export default class MisuseProp {}
