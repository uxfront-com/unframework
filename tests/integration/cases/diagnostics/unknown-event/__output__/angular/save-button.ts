import { Component, input, output } from "@angular/core";

@Component({
  selector: "uf-save-button",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <button
      type="button"
      (click)="save.emit()"
      [class]="this.class()"
      [style]="this.style()"
    >Save</button>
  `,
})
export class SaveButton {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly save = output<void>();
}
