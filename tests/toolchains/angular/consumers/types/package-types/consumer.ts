import { Component } from "@angular/core";

import Status from "../../../../../integration/cases/types/package-types/__output__/angular/status";

@Component({
  selector: "uf-status-consumer",
  imports: [Status],
  template: `<uf-status [label]="'Feed'" [value]="'tick'" [interval]="250" />`,
})
export default class Consumer {}
