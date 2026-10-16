import { Component } from "@angular/core";

import Steps, {
  StepsMarker,
} from "../../../../../integration/cases/slots/in-list/__output__/angular/steps";

@Component({
  selector: "uf-steps-consumer",
  imports: [Steps, StepsMarker],
  template: `
    <uf-steps [steps]="['Boil', 'Steep']">
      <ng-template ufStepsMarker><span aria-hidden="true">&gt; </span></ng-template>
    </uf-steps>
  `,
})
export default class Consumer {}
