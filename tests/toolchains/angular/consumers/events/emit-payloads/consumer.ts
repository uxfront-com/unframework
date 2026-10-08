import { Component } from "@angular/core";

import FileRow from "../../../../../integration/cases/events/emit-payloads/__output__/angular/file-row";

@Component({
  selector: "uf-file-row-consumer",
  imports: [FileRow],
  template: `<uf-file-row path="notes.txt" [size]="12" (open)="open($event)" />`,
})
export default class Consumer {
  protected open(path: string): string {
    return path.toUpperCase();
  }
}
