import { Component } from "@angular/core";

import Names, {
  NamesDefault,
} from "../../../../../integration/cases/slots/scoped-default/__output__/angular/names";

@Component({
  selector: "uf-names-misuse-slot",
  imports: [Names, NamesDefault],
  template: `
    <uf-names [names]="['Ada']">
      <!-- @uf-expect TS2339 Names.slot:default -->
      <ng-template ufNamesDefault let-name="name">{{ name }}</ng-template>
    </uf-names>
  `,
})
export default class MisuseSlot {}
