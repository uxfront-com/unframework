import { Component, computed, input, signal } from "@angular/core";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

@Component({
  selector: "uf-order-summary",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let quantity = this.quantity();
    @let subtotal = this.subtotal();
    @let tax = this.tax();
    @let total = this.total();
    @let tier = this.tier();
    <section class="order-summary" aria-label="Order summary" [attr.data-tier]="tier">
      <p role="status">Quantity: {{ quantity }}</p>
      <button
        type="button"
        [attr.disabled]="quantity === 1 ? '' : null"
        (click)="onRemoveOne()"
      >Remove one</button>
      <button type="button" (click)="onAddOne()">Add one</button>
      <p>Subtotal: {{ (subtotal / 100).toFixed(2) }}</p>
      <p>Tax: {{ (tax / 100).toFixed(2) }}</p>
      <p>Total: {{ (total / 100).toFixed(2) }}</p>
    </section>
  `,
})
export default class OrderSummary {
  readonly price = input.required<number>();
  readonly taxRate = input.required<number>();
  protected readonly quantity = signal(1);
  protected readonly subtotal = computed(() => this.quantity() * this.price());
  protected readonly tax = computed(() => Math.round(this.subtotal() * this.taxRate()));
  protected readonly total = computed(() => this.subtotal() + this.tax());
  protected readonly tier = computed(() => {
    if (this.total() >= 10000) return "bulk";
    return "standard";
  });

  protected onRemoveOne() {
    this.quantity.update((quantity) => quantity - 1);
  }

  protected onAddOne() {
    this.quantity.update((quantity) => quantity + 1);
  }
}
