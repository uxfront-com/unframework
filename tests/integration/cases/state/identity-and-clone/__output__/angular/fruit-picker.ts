import { Component, input, output, signal } from "@angular/core";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
}

@Component({
  selector: "uf-fruit-picker",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let fruits = this.fruits();
    @let selected = this.selected();
    @let basket = this.basket();
    <section class="fruit-picker" aria-label="Fruit">
      <ul aria-label="Fruits">
        @for (fruit of fruits; track fruit.name) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="fruit === selected"
              (click)="pick(fruit)"
            >{{ fruit.name }}</button>
          </li>
        }
      </ul>
      <button type="button" (click)="keep()">Keep a copy</button>
      <ol aria-label="Basket">
        @for (fruit of basket; track index; let index = $index) {
          <li>{{ fruit.name + " (" + fruit.colour + ")" }}</li>
        }
      </ol>
    </section>
  `,
})
export default class FruitPicker {
  readonly fruits = input.required<Fruit[]>();
  readonly kept = output<[name: string, colour: string]>();
  protected readonly selected = signal<Fruit | null>(null);
  protected readonly basket = signal<Fruit[]>([]);

  protected pick(fruit: Fruit) {
    this.selected.set(fruit);
  }

  protected keep() {
    const current = this.selected();
    if (!current) return;
    const copy = structuredClone(current);
    this.basket.set([...this.basket(), copy]);
    this.kept.emit([copy.name, copy.colour]);
  }
}
