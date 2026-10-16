import { Component } from "@angular/core";

import Stepper from "../../../../../integration/cases/models/component/__output__/angular/stepper";

@Component({
  selector: "uf-stepper-misuse-prop",
  imports: [Stepper],
  template: `
    <!-- @uf-expect TS2322 Stepper.prop:label -->
    <uf-stepper [label]="2" />
  `,
})
export default class MisuseProp {}
