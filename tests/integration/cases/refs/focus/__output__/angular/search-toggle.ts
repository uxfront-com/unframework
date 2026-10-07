import { Component, ElementRef, viewChild } from "@angular/core";

@Component({
  selector: "uf-search-toggle",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    <div class="search-toggle" role="search">
      <button type="button" #trigger (click)="focusField()">Search</button>
      <input name="query" aria-label="Search the docs" #field (keydown)="returnFocus($event)" />
    </div>
  `,
})
export default class SearchToggle {
  private readonly field = viewChild<ElementRef<HTMLInputElement>>("field");
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>("trigger");

  protected focusField() {
    this.field()?.nativeElement.focus();
  }

  protected returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") this.trigger()?.nativeElement.focus();
  }
}
