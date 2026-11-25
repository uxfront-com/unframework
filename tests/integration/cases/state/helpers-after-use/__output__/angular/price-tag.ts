import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import {
  Component,
  ElementRef,
  Injector,
  type OnInit,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
}

@Component({
  selector: "uf-price-tag",
  imports: [ScopeAttributes, Fallthrough],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
