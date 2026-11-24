import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-terms",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let agreed = this.agreed();
    <section
      aria-label="Terms"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label><input
        type="checkbox"
        #agreedField
        [checked]="this.agreed()"
        (change)="this.agreed.set(agreedField.checked)"
      /> I agree</label>
      <output>{{ agreed ? "Agreed" : "Not agreed" }}</output>
      <button type="button" (click)="onToggle()">Toggle</button>
    </section>
  `,
})
export default class Terms {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly agreed = signal(false);

  protected onToggle() {
    this.agreed.set(!this.agreed());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
