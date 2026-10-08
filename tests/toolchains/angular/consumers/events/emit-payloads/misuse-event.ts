import { Component } from "@angular/core";

import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/angular/file-row";

@Component({
  selector: "uf-file-row-misuse-event",
  imports: [FileRow],
  template: `
    <!-- @uf-expect TS2345 FileRow.event:open -->
    <uf-file-row path="notes.txt" [size]="12" (open)="open($event)" />
  `,
})
export default class MisuseEvent {
  protected open(index: number): number {
    return index + 1;
  }
}
