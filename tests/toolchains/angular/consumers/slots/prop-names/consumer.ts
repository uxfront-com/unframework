import { Component } from "@angular/core";

import Table, {
  TableRow,
} from "../../../../../integration/cases/slots/prop-names/__output__/angular/table";

@Component({
  selector: "uf-table-consumer",
  imports: [Table, TableRow],
  template: `
    <uf-table [people]="[{ id: 'a1', name: 'Ada' }]">
      <ng-template ufTableRow let-name="name" let-id="dataId">{{ name }} ({{ id }})</ng-template>
    </uf-table>
  `,
})
export default class Consumer {}
