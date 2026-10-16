import { Component, computed, input, output, signal } from "@angular/core";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

@Component({
  selector: "uf-checkout-total",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let subtotal = this.subtotal();
    @let method = this.method();
    @let shipping = this.shipping();
    @let total = this.total();
    <section
      class="checkout-total"
      aria-label="Order total"
      [class]="this.class()"
      [style]="this.style()"
    >
      <p>Subtotal: {{ formatCents(subtotal) }}</p>
      <p>Shipping: {{ formatCents(shipping) }}</p>
      <p role="status">Total: {{ total }}</p>
      <button
        type="button"
        [attr.aria-pressed]="method === 'standard'"
        (click)="chooseStandard()"
      >Standard shipping</button>
      <button
        type="button"
        [attr.aria-pressed]="method === 'express'"
        (click)="chooseExpress()"
      >Express shipping</button>
    </section>
  `,
})
export default class CheckoutTotal {
  readonly subtotal = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly shippingChange = output<ShippingMethod>();
  private readonly rates = { standard: 0, express: 1200 };
  protected readonly method = signal<ShippingMethod>("standard");
  protected readonly shipping = computed(() => this.rates[this.method()]);
  protected readonly total = computed(() => this.formatCents(this.subtotal() + this.shipping()));

  protected formatCents(cents: number): string {
    return `EUR ${(cents / 100).toFixed(2)}`;
  }

  private choose(next: ShippingMethod) {
    this.method.set(next);
    this.shippingChange.emit(next);
  }

  protected chooseExpress() {
    this.choose("express");
  }

  protected chooseStandard() {
    this.choose("standard");
  }
}
