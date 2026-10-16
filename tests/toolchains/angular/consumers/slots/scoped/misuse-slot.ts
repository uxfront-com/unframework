import { Component } from "@angular/core";

import List, {
  ListItem,
} from "../../../../../integration/cases/slots/scoped/__output__/angular/list";

@Component({
  selector: "uf-list-misuse-slot",
  imports: [List, ListItem],
  template: `
    <uf-list [items]="['a', 'b']" [label]="'Letters'">
      <!-- @uf-expect TS2339 List.slot:item -->
      <ng-template ufListItem let-size="size">{{ size }}</ng-template>
    </uf-list>
  `,
})
export default class MisuseSlot {}
