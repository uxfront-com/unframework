import { Component, signal } from "@angular/core";

import Stepper from "../../../../../integration/cases/models/component/__output__/angular/stepper";

@Component({
  selector: "uf-stepper-consumer",
  imports: [Stepper],
  template: `<uf-stepper [label]="'Cups'" [(value)]="cups" />`,
})
export default class Consumer {
  protected readonly cups = signal(2);
}
