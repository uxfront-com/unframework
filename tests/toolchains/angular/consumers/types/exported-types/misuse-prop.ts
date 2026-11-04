import { Component } from "@angular/core";

import Button from "../../../../../integration/cases/types/exported-types/__output__/angular/button";

@Component({
  selector: "uf-button-misuse-prop",
  imports: [Button],
  template: `
    <!-- @uf-expect TS2322 Button.prop:tone -->
    <uf-button [label]="'Save'" [tone]="'danger'" />
  `,
})
export default class MisuseProp {}
