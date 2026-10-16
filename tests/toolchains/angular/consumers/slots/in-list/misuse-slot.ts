import { Component } from "@angular/core";

import Steps, {
  StepsMarker,
} from "../../../../../integration/cases/slots/in-list/__output__/angular/steps";

@Component({
  selector: "uf-steps-misuse-slot",
  imports: [Steps, StepsMarker],
  template: `
    <uf-steps [steps]="['Boil']">
      <!-- @uf-expect TS2339 Steps.slot:marker -->
      <ng-template ufStepsMarker let-props>{{ props }}</ng-template>
    </uf-steps>
  `,
})
export default class MisuseSlot {}
