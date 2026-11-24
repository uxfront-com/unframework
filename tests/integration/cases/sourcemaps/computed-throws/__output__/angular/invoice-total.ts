import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, computed, inject, input, signal, viewChild } from "@angular/core";

export interface InvoiceTotalProps {
  quantity: number;
}

@Component({
  selector: "uf-invoice-total",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let refunded = this.refunded();
    @let total = this.total();
    <div
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <output>{{ total + " after " + refunded + " refunded" }}</output>
      <button type="button" (click)="refund()">Refund</button>
    </div>
  `,
})
export default class InvoiceTotal {
  readonly quantity = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLDivElement>>("ufElement");
  protected readonly refunded = signal(0);
  protected readonly total = computed(() => {
    const units = this.quantity() - this.refunded();
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  });

  protected refund() {
    this.refunded.set(this.refunded() + 3);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
