import { Component, output } from "@angular/core";

@Component({
  selector: "uf-save-button",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <button type="button" (click)="save.emit()">Save</button>
  `,
})
export class SaveButton {
  readonly save = output<void>();
}
