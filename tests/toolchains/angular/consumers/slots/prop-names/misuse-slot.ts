import { Component } from "@angular/core";

import Table, {
  TableRow,
} from "../../../../../integration/cases/slots/prop-names/__output__/angular/table";

@Component({
  selector: "uf-table-misuse-slot",
  imports: [Table, TableRow],
  template: `
    <uf-table [people]="[]">
      <!-- @uf-expect TS2339 Table.slot:row -->
      <ng-template ufTableRow let-age="age">{{ age }}</ng-template>
    </uf-table>
  `,
})
export default class MisuseSlot {}
