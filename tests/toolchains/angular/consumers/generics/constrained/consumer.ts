import { Component } from "@angular/core";

import Table from "../../../../../integration/cases/generics/constrained/__output__/angular/table";

@Component({
  selector: "uf-table-consumer",
  imports: [Table],
  template: `<uf-table
    [caption]="'People'"
    [rows]="[{ id: 'ada', label: 'Ada Lovelace', born: 1815 }]"
  />`,
})
export default class Consumer {}
