import { Component, ElementRef, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-search-toggle",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div class="search-toggle" role="search" [class]="this.class()" [style]="this.style()">
      <button type="button" #trigger (click)="focusField()">Search</button>
      <input name="query" aria-label="Search the docs" #field (keydown)="returnFocus($event)" />
    </div>
  `,
})
export default class SearchToggle {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly field = viewChild<ElementRef<HTMLInputElement>>("field");
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>("trigger");

  protected focusField() {
    this.field()?.nativeElement.focus();
  }

  protected returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") this.trigger()?.nativeElement.focus();
  }
}
