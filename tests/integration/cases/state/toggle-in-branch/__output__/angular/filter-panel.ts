import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-filter-panel",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    @let colour = this.colour();
    @let note = this.note();
    <section
      class="filter-panel"
      aria-label="Filters"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (open) {
        <button type="button" aria-expanded="true" (click)="onHideColours()">Hide colours</button>
      } @else {
        <button type="button" aria-expanded="false" (click)="onShowColours()">Show colours</button>
      }
      @if (open) {
        <div class="colours">
          <button type="button" (click)="onRed()">Red</button>
          <button type="button" (click)="onBlue()">Blue</button>
          <button type="button" (click)="onReset()">Reset</button>
        </div>
      }
      @if (colour) {
        <div class="selection">
          <p>{{ "Colour: " + colour }}</p>
          <button type="button" (click)="onClick()">{{ "Clear " + colour }}</button>
        </div>
      } @else {
        <p>No colour</p>
      }
      @if (note === null) {
        <button type="button" (click)="onAddANote()">Add a note</button>
      } @else {
        <div class="note">
          <label>Note<input (input)="onInput($event)" (keydown)="onKeydown($event)" /></label>
          <p>{{ 'Draft: "' + note + '"' }}</p>
        </div>
      }
    </section>
  `,
})
export default class FilterPanel {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly open = signal(false);
  protected readonly colour = signal<string | null>(null);
  protected readonly note = signal<string | null>(null);

  protected onHideColours() {
    this.open.set(false);
  }

  protected onShowColours() {
    this.open.set(true);
  }

  protected onRed() {
    this.colour.set("Red");
  }

  protected onBlue() {
    this.colour.set("Blue");
  }

  protected onReset() {
    this.colour.set(null);
    this.open.set(false);
  }

  protected onClick() {
    this.colour.set(null);
  }

  protected onAddANote() {
    this.note.set("");
  }

  protected onInput(event: InputEvent) {
    this.note.set((event.currentTarget as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      this.note.set(null);
    }
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
