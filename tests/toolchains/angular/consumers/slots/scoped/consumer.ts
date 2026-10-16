import { Component } from "@angular/core";

import List, {
  ListItem,
} from "../../../../../integration/cases/slots/scoped/__output__/angular/list";

@Component({
  selector: "uf-list-consumer",
  imports: [List, ListItem],
  template: `
    <uf-list [items]="['a', 'b']" [label]="'Letters'">
      <ng-template ufListItem let-item="item" let-index="index"
        >{{ index }}: {{ item.toUpperCase() }}</ng-template
      >
    </uf-list>
  `,
})
export default class Consumer {}
