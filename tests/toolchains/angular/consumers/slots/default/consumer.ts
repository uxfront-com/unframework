import { Component } from "@angular/core";

import Panel from "../../../../../integration/cases/slots/default/__output__/angular/panel";

@Component({
  selector: "uf-panel-consumer",
  imports: [Panel],
  template: `<uf-panel [title]="'Welcome'"><p>Hello</p></uf-panel>`,
})
export default class Consumer {}
