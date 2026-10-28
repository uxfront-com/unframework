import { Component } from "@angular/core";

import Status from "../../../../../integration/cases/types/package-types/__output__/angular/status";

@Component({
  selector: "uf-status-misuse-prop",
  imports: [Status],
  template: `
    <!-- @uf-expect TS2322 Status.prop:interval -->
    <uf-status [label]="'Feed'" [value]="'tick'" [interval]="'fast'" />
  `,
})
export default class MisuseProp {}
