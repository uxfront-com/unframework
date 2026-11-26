import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-search-toggle",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <div
      class="search-toggle"
      role="search"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" #trigger (click)="focusField()">Search</button>
      <input name="query" aria-label="Search the docs" #field (keydown)="returnFocus($event)" />
    </div>
  `,
})
export default class SearchToggle {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly field = viewChild<ElementRef<HTMLInputElement>>("field");
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>("trigger");
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");

  protected focusField() {
    this.field()?.nativeElement.focus();
  }

  protected returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") this.trigger()?.nativeElement.focus();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
