import { Component } from "@angular/core";

import Table from "../../../../../integration/cases/generics/constrained/__output__/angular/table";

@Component({
  selector: "uf-table-misuse-prop",
  imports: [Table],
  template: `
    <!-- @uf-expect TS2322 Table.prop:rows -->
    <uf-table [caption]="'People'" [rows]="[{ id: 1, label: 'Ada Lovelace' }]" />
  `,
})
export default class MisuseProp {}
