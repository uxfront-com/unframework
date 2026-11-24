import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useToggle } from "./use-toggle";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

@Component({
  selector: "uf-disclosure",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let on = this.toggle_1.on();
    <section
      class="disclosure"
      aria-label="Shipping"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button
        type="button"
        [attr.aria-expanded]="on"
        (click)="void toggle_1.toggle()"
      >Shipping details</button>
      @if (on) {
        <div class="panel">
          <p>Orders ship within two days.</p>
          <button type="button" (click)="void toggle_1.close()">Close</button>
        </div>
      }
    </section>
  `,
})
export default class Disclosure {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly toggle_1 = useToggle(false);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
