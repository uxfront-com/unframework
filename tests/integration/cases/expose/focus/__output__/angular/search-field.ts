import { Component, ElementRef, input as input_1, viewChild } from "@angular/core";

@Component({
  selector: "uf-search-field",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <label
      class="search"
      [class]="this.class()"
      [style]="this.style()"
    >{{ label }}<input #input type="search" /></label>
  `,
})
export default class SearchField {
  readonly label = input_1.required<string>();
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");

  focus() {
    this.input()?.nativeElement.focus();
  }
}
