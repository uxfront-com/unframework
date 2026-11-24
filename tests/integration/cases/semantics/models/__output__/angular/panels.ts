import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Disclosure from "./disclosure";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-panels",
  imports: [Disclosure, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let shipping = this.shipping();
    <section
      aria-label="Panels"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-disclosure [title]="'Shipping'" [(open)]="this.shipping" />
      <uf-disclosure [title]="'Returns'" />
      <output>Shipping is {{ shipping ? "open" : "closed" }}</output>
      <button type="button" (click)="onToggleShipping()">Toggle shipping</button>
    </section>
  `,
})
export default class Panels {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly shipping = signal(true);

  protected onToggleShipping() {
    this.shipping.set(!this.shipping());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
