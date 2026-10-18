import { Component, input, model } from "@angular/core";

@Component({
  selector: "uf-choice",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let picked = this.picked();
    <button
      type="button"
      (click)="onClick()"
      [class]="this.class()"
      [style]="this.style()"
    >Yes ({{ picked }})</button>
  `,
})
export class Choice {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly picked = model<string>("");

  protected onClick() {
    this.picked.set("yes");
  }
}
