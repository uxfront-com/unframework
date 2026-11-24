import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

@Component({
  selector: "uf-save-indicator",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let saving = this.saving();
    @let changes = this.changes();
    @let savedAt = this.savedAt();
    <p
      class="save-indicator"
      role="status"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (saving) {<em>Saving</em>} @else {Saved}, {{ changes === 1 ? "1 change" : changes + " changes" }}@if (savedAt) {<time
        [attr.datetime]="savedAt"
      >{{ " at " + savedAt }}</time>} @else { just now}
    </p>
  `,
})
export default class SaveIndicator {
  readonly saving = input.required<boolean>();
  readonly changes = input.required<number>();
  readonly savedAt = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
