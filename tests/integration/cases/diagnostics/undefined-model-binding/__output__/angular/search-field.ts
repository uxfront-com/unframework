import { Component, input, model } from "@angular/core";

@Component({
  selector: "uf-search-field",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <input
      type="search"
      aria-label="Search"
      #queryField
      [value]="this.query()"
      (input)="this.query.set(queryField.value)"
      [class]="this.class()"
      [style]="this.style()"
    />
  `,
})
export class SearchField {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly query = model<string>();
}
