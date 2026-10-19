import { Component, input } from "@angular/core";

@Component({
  selector: "uf-field",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <label
      [class]="this.class()"
      [style]="this.style()"
    >{{ label }}&ngsp;<input type="text" /></label>
  `,
})
export class Field {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
}
