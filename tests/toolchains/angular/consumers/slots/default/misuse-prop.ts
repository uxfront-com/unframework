import { Component } from "@angular/core";

import Panel from "../../../../../integration/cases/slots/default/__output__/angular/panel";

@Component({
  selector: "uf-panel-misuse-prop",
  imports: [Panel],
  template: `
    <!-- @uf-expect TS2322 Panel.prop:title -->
    <uf-panel [title]="1"><p>Hello</p></uf-panel>
  `,
})
export default class MisuseProp {}
