import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input as input_1, viewChild } from "@angular/core";

@Component({
  selector: "uf-search-field",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    <label
      class="search"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
    >{{ label }}<input #input type="search" /></label>
  `,
})
export default class SearchField {
  readonly label = input_1.required<string>();
  readonly class = input_1<string>();
  readonly style = input_1<Record<string, string | null | undefined>>();
  readonly ufAttributes = input_1<Record<string, unknown>>();
  readonly ufListeners = input_1<Listeners>();
  private readonly input = viewChild<ElementRef<HTMLInputElement>>("input");

  focus() {
    this.input()?.nativeElement.focus();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
