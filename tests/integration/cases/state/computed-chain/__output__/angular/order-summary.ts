import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformBrowser } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnChanges,
  type OnDestroy,
  PLATFORM_ID,
  Renderer2,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

/** A native listener of each event a consumer passes, by the event's name (ADR-0118). */
type Listeners = { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };

/**
 * Puts what a consumer passes the component, and the component does not declare, on the element
 * that takes it (ADR-0118): the attributes, the consumer's winning over the element's own, and
 * the native listeners, which run after the element's own.
 */
@Directive({ selector: "[ufFallthrough]" })
export class Fallthrough implements OnChanges, OnDestroy {
  readonly ufFallthrough = input.required<{
    attributes: Record<string, unknown> | undefined;
    listeners: Listeners | undefined;
  }>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly listening = new Map<string, { handler: unknown; stop: () => void }>();
  private written: Record<string, unknown> = {};

  ngOnChanges(): void {
    const element = this.element.nativeElement;
    const { attributes = {}, listeners = {} } = this.ufFallthrough();
    for (const name of Object.keys(this.written)) {
      if (!(name in attributes)) this.renderer.removeAttribute(element, name);
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) this.renderer.removeAttribute(element, name);
      else this.renderer.setAttribute(element, name, String(value));
    }
    this.written = attributes;
    if (!this.browser) return;
    const handlers = new Map(Object.entries(listeners));
    for (const [event, { handler, stop }] of this.listening) {
      if (handlers.get(event) === handler) continue;
      stop();
      this.listening.delete(event);
    }
    for (const [event, handler] of handlers) {
      if (handler === undefined || this.listening.has(event)) continue;
      this.listening.set(event, { handler, stop: this.renderer.listen(element, event, handler) });
    }
  }

  ngOnDestroy(): void {
    for (const { stop } of this.listening.values()) stop();
  }
}

@Component({
  selector: "uf-order-summary",
  imports: [ScopeAttributes, Fallthrough],
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
      [attr.data-tier]="'data-tier' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['data-tier'] : tier"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
