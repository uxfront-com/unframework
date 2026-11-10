import { Component } from "@angular/core";

import Button from "../../../../../integration/cases/types/extends-chain/__output__/angular/button";

@Component({
  selector: "uf-button-consumer",
  imports: [Button],
  template: `<uf-button [id]="'save'" [label]="'Save'" [disabled]="true" />`,
})
export default class Consumer {}
