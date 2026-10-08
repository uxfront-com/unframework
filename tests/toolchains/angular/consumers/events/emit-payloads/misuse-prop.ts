import { Component } from "@angular/core";

import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/angular/file-row";

@Component({
  selector: "uf-file-row-misuse-prop",
  imports: [FileRow],
  template: `
    <!-- @uf-expect TS2322 FileRow.prop:path -->
    <uf-file-row [path]="42" [size]="12" />
  `,
})
export default class MisuseProp {}
