import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { VFocusTrap } from "./v-focus-trap";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-settings",
  imports: [ScopeAttributes, Fallthrough, VFocusTrap],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let open = this.open();
    <section
      class="settings"
      aria-label="Settings"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" (click)="onOpen()">Open</button>
      @if (open) {
        <div
          role="dialog"
          aria-label="Preferences"
          tabindex="-1"
          class="dialog"
          [vFocusTrap]="open"
          (keydown)="onKeydown($event)"
        >
          <button type="button">Theme</button>
          <button type="button">Language</button>
          <button type="button" (click)="close()">Close</button>
        </div>
      }
    </section>
  `,
})
export default class Settings {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly open = signal(false);

  protected close() {
    this.open.set(false);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") this.close();
  }

  protected onOpen() {
    this.open.set(true);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
