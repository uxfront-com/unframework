import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

export type ShippingMethod = "standard" | "express";

export interface CheckoutTotalProps {
  /** The order's subtotal, in cents. */
  subtotal: number;
}

@Component({
  selector: "uf-checkout-total",
  imports: [ScopeAttributes, Fallthrough],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly shippingChange = output<ShippingMethod>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
