import { Component } from "@angular/core";

import Names, {
  NamesDefault,
} from "../../../../../integration/cases/slots/scoped-default/__output__/angular/names";

@Component({
  selector: "uf-names-consumer",
  imports: [Names, NamesDefault],
  template: `
    <uf-names [names]="['Ada']">
      <ng-template ufNamesDefault let-item="item"
        ><b>{{ item.toUpperCase() }}</b></ng-template
      >
    </uf-names>
  `,
})
export default class Consumer {}
