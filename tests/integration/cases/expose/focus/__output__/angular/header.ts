import SearchField from "./search-field";
import { Component, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-header",
  imports: [SearchField],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <header class="header" [class]="this.class()" [style]="this.style()">
      <uf-search-field #search [label]="'Find'" />
      <button type="button" (click)="onSearch()">Search</button>
    </header>
  `,
})
export default class Header {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly search = viewChild<{ focus(): void }>("search");

  protected onSearch() {
    this.search()?.focus();
  }
}
