import { Component } from "@angular/core";

import Steps from "../../../../../integration/cases/slots/in-list/__output__/angular/steps";

@Component({
  selector: "uf-steps-misuse-prop",
  imports: [Steps],
  template: `
    <!-- @uf-expect TS2322 Steps.prop:steps -->
    <uf-steps [steps]="'Boil'" />
  `,
})
export default class MisuseProp {}
