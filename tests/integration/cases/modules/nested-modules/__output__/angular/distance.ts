import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { formatDistance } from "./format";
import type { Unit } from "./units";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-distance",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let value = this.value();
    @let unit = this.unit();
    <section
      class="distance"
      aria-label="Distance"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">{{ formatDistance(value, unit) }}</p>
      <button type="button" (click)="onSwitchUnits()">Switch units</button>
    </section>
  `,
})
export default class Distance {
  readonly value = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly unit = signal<Unit>("km");
  protected readonly formatDistance = formatDistance;

  protected onSwitchUnits() {
    this.unit.set(this.unit() === "km" ? "mi" : "km");
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
