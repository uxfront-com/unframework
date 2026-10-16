import { Component, signal } from "@angular/core";

import Stepper from "../../../../../integration/cases/models/component/__output__/angular/stepper";

@Component({
  selector: "uf-stepper-misuse-model",
  imports: [Stepper],
  template: `
    <!-- @uf-expect TS2322 Stepper.model:value -->
    <uf-stepper [label]="'Cups'" [(value)]="cups" />
  `,
})
export default class MisuseModel {
  protected readonly cups = signal("two");
}
