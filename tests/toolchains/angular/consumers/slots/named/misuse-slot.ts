import { Component } from "@angular/core";

import Card, {
  CardHeader,
} from "../../../../../integration/cases/slots/named/__output__/angular/card";

@Component({
  selector: "uf-card-misuse-slot",
  imports: [Card, CardHeader],
  template: `
    <uf-card>
      <!-- @uf-expect TS2339 Card.slot:header -->
      <ng-template ufCardHeader let-props>{{ props }}</ng-template>
    </uf-card>
  `,
})
export default class MisuseSlot {}
