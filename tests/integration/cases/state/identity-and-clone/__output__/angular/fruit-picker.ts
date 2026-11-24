import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
}

@Component({
  selector: "uf-fruit-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let fruits = this.fruits();
    @let selected = this.selected();
    @let basket = this.basket();
    <section
      class="fruit-picker"
      aria-label="Fruit"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly kept = output<[name: string, colour: string]>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
