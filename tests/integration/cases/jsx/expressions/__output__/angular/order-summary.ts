import { Component, input } from "@angular/core";

export interface OrderSummaryProps {
  customer: string;
  orderNumber: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  coupon?: string;
}

@Component({
  selector: "uf-order-summary",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let customer = this.customer();
    @let orderNumber = this.orderNumber();
    @let unitPrice = this.unitPrice();
    @let quantity = this.quantity();
    @let discount = this.discount();
    @let coupon = this.coupon();
    <section class="order-summary" aria-label="Order summary">
      <h2>Order {{ String(orderNumber).padStart(6, "0") }}</h2>
      <p>Customer: {{ customer.trim().toUpperCase() }}</p>
      <p>{{ "" + quantity + " item" + (quantity === 1 ? "" : "s") + " at " + unitPrice.toFixed(2) + " each" }}</p>
      <p>Subtotal: {{ (unitPrice * quantity).toFixed(2) }}</p>
      <p>Discount: {{ Math.min(Math.max(discount, 0), 50) }}%</p>
      <p>Total: {{ (unitPrice * quantity * (1 - Math.min(Math.max(discount, 0), 50) / 100)).toFixed(2) }}</p>
      <p>{{ quantity > 10 ? "Bulk order" : "Standard order" }}, {{ coupon ? "coupon applied" : "no coupon" }}</p>
      <p>Points earned: {{ Math.round(unitPrice * quantity) % 100 }}</p>
    </section>
  `,
})
export default class OrderSummary {
  readonly customer = input.required<string>();
  readonly orderNumber = input.required<number>();
  readonly unitPrice = input.required<number>();
  readonly quantity = input.required<number>();
  readonly discount = input.required<number>();
  readonly coupon = input<string>();
  protected readonly Math = Math;
  protected readonly String = String;
}
