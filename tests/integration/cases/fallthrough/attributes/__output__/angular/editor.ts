import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import SaveButton from "./save-button";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-editor",
  imports: [SaveButton, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let pressed = this.pressed();
    <div
      class="editor"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p id="save-hint">Saves the draft.</p>
      <uf-save-button
        [title]="'Save'"
        [class]="'primary'"
        [ufAttributes]="{ id: 'save', 'aria-describedby': 'save-hint', 'aria-pressed': pressed, 'data-testid': 'save-button', type: 'submit' }"
      />
      <button type="button" (click)="onToggle()">Toggle</button>
    </div>
  `,
})
export default class Editor {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly pressed = signal(false);

  protected onToggle() {
    this.pressed.set(!this.pressed());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
