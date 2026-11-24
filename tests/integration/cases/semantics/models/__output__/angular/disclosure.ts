import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, model, viewChild } from "@angular/core";

@Component({
  selector: "uf-disclosure",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let open = this.open();
    <div
      class="disclosure"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <button type="button" [attr.aria-expanded]="open" (click)="onClick()">{{ title }}</button>
      @if (open) {
        <p>Details of {{ title }}</p>
      }
    </div>
  `,
})
export default class Disclosure {
  readonly title = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly open = model<boolean>(false);
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");

  protected onClick() {
    this.open.set(!this.open());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
