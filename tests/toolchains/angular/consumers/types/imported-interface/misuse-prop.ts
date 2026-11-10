import { Component } from "@angular/core";

import Badge from "../../../../../integration/cases/types/imported-interface/__output__/angular/badge";

@Component({
  selector: "uf-badge-misuse-prop",
  imports: [Badge],
  template: `
    <!-- @uf-expect TS2322 Badge.prop:tone -->
    <uf-badge [label]="'New'" [tone]="'warning'" />
  `,
})
export default class MisuseProp {}
