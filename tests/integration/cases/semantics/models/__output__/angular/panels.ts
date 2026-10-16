import Disclosure from "./disclosure";
import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-panels",
  imports: [Disclosure],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let shipping = this.shipping();
    <section aria-label="Panels" [class]="this.class()" [style]="this.style()">
      <uf-disclosure [title]="'Shipping'" [(open)]="this.shipping" />
      <uf-disclosure [title]="'Returns'" />
      <output>Shipping is {{ shipping ? "open" : "closed" }}</output>
      <button type="button" (click)="onToggleShipping()">Toggle shipping</button>
    </section>
  `,
})
export default class Panels {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly shipping = signal(true);

  protected onToggleShipping() {
    this.shipping.set(!this.shipping());
  }
}
