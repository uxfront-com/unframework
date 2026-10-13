import { Component } from "@angular/core";

import Notice from "../../../../../integration/cases/slots/fallback/__output__/angular/notice";

@Component({
  selector: "uf-notice-misuse-prop",
  imports: [Notice],
  template: `
    <!-- @uf-expect TS2322 Notice.prop:label -->
    <uf-notice [label]="false" />
  `,
})
export default class MisuseProp {}
