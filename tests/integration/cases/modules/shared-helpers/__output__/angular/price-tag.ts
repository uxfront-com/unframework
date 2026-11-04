import { formatPrice, pluralise } from "./format";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

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
  selector: "uf-price-tag",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let cents = this.cents();
    @let quantity = this.quantity();
    @let total = this.total();
    <section
      class="price-tag"
      aria-label="Price"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>Each: {{ formatPrice(cents) }}</p>
      <p role="status">{{ pluralise(quantity, "item") }}: {{ total }}</p>
      <button type="button" (click)="onOneMore()">One more</button>
      <button type="button" (click)="onOrder()">Order</button>
    </section>
  `,
})
export default class PriceTag {
  readonly cents = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly order = output<string>();
  protected readonly quantity = signal(1);
  protected readonly total = computed(() => formatPrice(this.cents() * this.quantity()));
  protected readonly formatPrice = formatPrice;
  protected readonly pluralise = pluralise;

  protected onOrder() {
    this.order.emit(`${pluralise(this.quantity(), "item")} for ${this.total()}`);
  }

  protected onOneMore() {
    this.quantity.update((quantity) => quantity + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
