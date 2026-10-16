import Card from "./card";
import Chip from "./chip";
import { Component, input, signal } from "@angular/core";

@Component({
  selector: "uf-tag",
  imports: [Chip, Card],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let compact = this.compact();
    <section aria-label="Tag" [class]="this.class()" [style]="this.style()">
      @switch (compact ? "Chip" : "Card") {
        @case ("Chip") {
          <uf-chip [label]="label" />
        } @case ("Card") {
          <uf-card [label]="label" />
        }
      }
      <button type="button" (click)="onClick()">{{ compact ? "Expand" : "Compact" }}</button>
    </section>
  `,
})
export default class Tag {
  readonly label = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly compact = signal(true);

  protected onClick() {
    this.compact.set(!this.compact());
  }
}
