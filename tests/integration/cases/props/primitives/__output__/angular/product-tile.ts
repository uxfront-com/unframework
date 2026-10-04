import { Component, input } from "@angular/core";

export interface ProductTileProps {
  name: string;
  price: number;
  stock: number;
  available?: boolean;
}

@Component({
  selector: "uf-product-tile",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let price = this.price();
    @let stock = this.stock();
    @let available = this.available();
    <article class="product-tile" [attr.aria-label]="name">
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
}
