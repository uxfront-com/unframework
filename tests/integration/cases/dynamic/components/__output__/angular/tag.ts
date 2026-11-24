import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Card from "./card";
import Chip from "./chip";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-tag",
  imports: [Chip, Card, ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let label = this.label();
    @let compact = this.compact();
    <section
      aria-label="Tag"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
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
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly compact = signal(true);

  protected onClick() {
    this.compact.set(!this.compact());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
