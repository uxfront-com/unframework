import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
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
    @let quantity = this.quantity();
    @let subtotal = this.subtotal();
    @let tax = this.tax();
    @let total = this.total();
    @let tier = this.tier();
    <section
      class="order-summary"
      aria-label="Order summary"
      [attr.data-tier]="tier"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
