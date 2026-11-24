import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

@Component({
  selector: "uf-order-status",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let carrier = this.carrier();
    @let eta = this.eta();
    <p
      class="order-status"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      @if (status === "pending") {Waiting for payment.} @else if (status === "shipped") {<strong>Shipped</strong> with {{ carrier ?? "our courier" }}, arriving {{ eta ?? "soon" }}.} @else if (status === "delivered") {<strong>Delivered</strong>} @else {<em>Cancelled</em>}
    </p>
  `,
})
export default class OrderStatus {
  readonly status = input.required<"pending" | "shipped" | "delivered" | "cancelled">();
  readonly carrier = input<string>();
  readonly eta = input<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLParagraphElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
