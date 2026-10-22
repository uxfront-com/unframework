import {
  Component,
  Directive,
  ElementRef,
  Injector,
  type OnInit,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from "@angular/core";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
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
  selector: "uf-price-tag",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let unit = this.unit();
    @let summary = this.summary();
    @let total = this.total();
    @let last = this.last();
    <section
      class="price-tag"
      aria-label="Price"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p>Unit: {{ unit }}</p>
      <p role="status">{{ summary }}</p>
      <p>Total: {{ total }}</p>
      <p>Last change: {{ last }}</p>
      <button type="button" (click)="add()">Add one</button>
      <button type="button" (click)="onPriceTwo()">Price two</button>
    </section>
  `,
})
export default class PriceTag implements OnInit {
  readonly price = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly injector = inject(Injector);
  private readonly quantity = signal(1);
  protected readonly unit = linkedSignal(() => untracked(() => this.formatCents(this.price())));
  protected readonly summary = linkedSignal(() => untracked(() => this.describe()));
  protected readonly total = computed(() => this.formatCents(this.price() * this.quantity()));
  protected readonly last = signal("none");

  ngOnInit(): void {
    // Read once the inputs are set: these keep the values they start with.
    this.unit();
    this.summary();

    const currentQuantity = computed(() => this.quantity());
    let lastQuantity = currentQuantity();
    effect(
      () => {
        const value = currentQuantity();
        if (Object.is(value, lastQuantity)) return;
        lastQuantity = value;
        untracked(() => {
          this.last.set(this.describe());
        });
      },
      { injector: this.injector },
    );
  }

  protected add() {
    this.quantity.update((quantity) => quantity + 1);
    this.summary.set(this.describe());
  }

  private formatCents(cents: number): string {
    return `EUR ${(cents / 100).toFixed(2)}`;
  }

  private describe(): string {
    return `${this.quantity()} at ${this.formatCents(this.price())}`;
  }

  protected onPriceTwo() {
    this.unit.set(this.formatCents(this.price() * 2));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
