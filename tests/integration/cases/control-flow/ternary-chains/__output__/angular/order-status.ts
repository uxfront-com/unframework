import { Component, input } from "@angular/core";

export interface OrderStatusProps {
  status: "pending" | "shipped" | "delivered" | "cancelled";
  carrier?: string;
  eta?: string;
}

@Component({
  selector: "uf-order-status",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let status = this.status();
    @let carrier = this.carrier();
    @let eta = this.eta();
    <p class="order-status">
      @if (status === "pending") {Waiting for payment.} @else if (status === "shipped") {<strong>Shipped</strong> with {{ carrier ?? "our courier" }}, arriving {{ eta ?? "soon" }}.} @else if (status === "delivered") {<strong>Delivered</strong>} @else {<em>Cancelled</em>}
    </p>
  `,
})
export default class OrderStatus {
  readonly status = input.required<"pending" | "shipped" | "delivered" | "cancelled">();
  readonly carrier = input<string>();
  readonly eta = input<string>();
}
