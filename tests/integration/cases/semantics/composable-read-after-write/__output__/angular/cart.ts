import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useCart } from "./use-cart";
import { Component, ElementRef, inject, input, output, viewChild } from "@angular/core";

@Component({
  selector: "uf-cart",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.cart.items();
    <section
      class="cart"
      aria-label="Cart"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Items: {{ items }}</p>
      <button type="button" (click)="addTwiceAndReport()">Add three</button>
      <button type="button" (click)="clearAndReport()">Clear</button>
    </section>
  `,
})
export default class Cart {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly total = output<number>();
  readonly cleared = output<boolean>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly cart = useCart();

  protected addTwiceAndReport() {
    this.cart.add(1);
    this.cart.add(2);
    this.total.emit(this.cart.items());
  }

  protected clearAndReport() {
    this.cart.clear();
    this.cleared.emit(this.cart.empty());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
