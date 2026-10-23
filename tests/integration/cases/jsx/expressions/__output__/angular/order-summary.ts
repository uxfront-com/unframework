import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface OrderSummaryProps {
  customer: string;
  orderNumber: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  coupon?: string;
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-order-summary",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let customer = this.customer();
    @let orderNumber = this.orderNumber();
    @let unitPrice = this.unitPrice();
    @let quantity = this.quantity();
    @let discount = this.discount();
    @let coupon = this.coupon();
    <section
      class="order-summary"
      aria-label="Order summary"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2>Order {{ String(orderNumber).padStart(6, "0") }}</h2>
      <p>Customer: {{ customer.trim().toUpperCase() }}</p>
      <p>{{ quantity + " item" + (quantity === 1 ? "" : "s") + " at " + unitPrice.toFixed(2) + " each" }}</p>
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly Math = Math;
  protected readonly String = String;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
