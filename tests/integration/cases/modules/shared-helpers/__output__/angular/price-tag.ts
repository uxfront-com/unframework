import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { formatPrice, pluralise } from "./format";
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

@Component({
  selector: "uf-price-tag",
  imports: [ScopeAttributes, Fallthrough],
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
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly order = output<string>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
