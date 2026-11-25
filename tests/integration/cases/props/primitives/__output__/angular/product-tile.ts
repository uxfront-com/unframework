import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, viewChild } from "@angular/core";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

@Component({
  selector: "uf-product-tile",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let price = this.price();
    @let stock = this.stock();
    @let available = this.available();
    <article
      class="product-tile"
      [attr.aria-label]="'aria-label' in (this.ufAttributes() ?? {}) ? this.ufAttributes()?.['aria-label'] : name"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <h2>{{ name }}</h2>
      <p>Price: {{ price }} EUR</p>
      <p [attr.data-stock]="stock">{{ stock }} in stock</p>
      <p>{{ available ? "Available to order" : "Currently unavailable" }}</p>
      <button
        type="button"
        [attr.disabled]="!available ? '' : null"
      >Add {{ name }} to basket</button>
    </article>
  `,
})
export default class ProductTile {
  readonly name = input.required<string>();
  readonly price = input.required<number>();
  readonly stock = input.required<number>();
  readonly available = input<boolean, boolean | undefined>(true, {
    transform: (value) => (value === undefined ? true : value),
  });
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
