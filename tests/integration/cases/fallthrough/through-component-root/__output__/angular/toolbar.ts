import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import SaveAction from "./save-action";
import { Component, ElementRef, computed, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-toolbar",
  imports: [SaveAction, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let clicks = this.clicks();
    <div
      role="toolbar"
      aria-label="Actions"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-save-action
        #save
        [text]="'Save'"
        [ufAttributes]="{ id: 'save', 'aria-label': 'Save draft' }"
        [ufListeners]="{ click: () => onSaveDraft() }"
      />
      <button type="button" (click)="onFocusSave()">Focus save</button>
      <p>Clicks: {{ clicks }}</p>
    </div>
  `,
})
export default class Toolbar {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  private readonly saveComponent = viewChild("save", { read: SaveAction });
  private readonly save = computed<ElementRef<HTMLButtonElement> | undefined>(() =>
    this.saveComponent()?.ufElement(),
  );
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly clicks = signal(0);

  protected onSaveDraft() {
    this.clicks.update((clicks) => clicks + 1);
  }

  protected onFocusSave() {
    this.save()?.nativeElement.focus();
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
