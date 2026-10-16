import Stepper from "./stepper";
import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-order",
  imports: [Stepper],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let cups = this.cups();
    <section aria-label="Order" [class]="this.class()" [style]="this.style()">
      <uf-stepper [label]="'Cups'" [(value)]="this.cups" />
      <output>Ordered: {{ cups }}</output>
      <button type="button" (click)="onClear()">Clear</button>
    </section>
  `,
})
export default class Order {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly cups = signal(2);

  protected onClear() {
    this.cups.set(0);
  }
}
