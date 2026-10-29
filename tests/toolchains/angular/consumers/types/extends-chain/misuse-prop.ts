import { Component } from "@angular/core";

import Button from "../../../../../integration/cases/types/extends-chain/__output__/angular/button";

@Component({
  selector: "uf-button-misuse-prop",
  imports: [Button],
  template: `
    <!-- @uf-expect TS2322 Button.prop:label -->
    <uf-button [id]="'save'" [label]="1" />
  `,
})
export default class MisuseProp {}
