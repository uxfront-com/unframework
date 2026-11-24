import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

/**
 * A checkbox group's array once a box is checked or unchecked, as Vue's `vModelCheckbox`
 * writes it (ADR-0054): a new array with the box's value added or removed.
 */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked) return index === -1 ? [...values, value] : [...values];
  return values.filter((_, at) => at !== index);
}

@Component({
  selector: "uf-delivery",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let speeds = this.speeds();
    @let extras = this.extras();
    @let speed = this.speed();
    @let chosen = this.chosen();
    <section
      aria-label="Delivery"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <fieldset>
        <legend>Speed</legend>
        @for (value of speeds; track value) {
          <label><input
            type="radio"
            name="speed"
            [attr.value]="value"
            [checked]="this.speed() === value"
            (change)="this.speed.set(value)"
          />&ngsp;{{ value }}</label>
        }
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        @for (extra of extras; track extra) {
          <label><input
            type="checkbox"
            [attr.value]="extra"
            #chosenField
            [checked]="this.chosen().includes(extra)"
            (change)="this.chosen.set(toggle(this.chosen(), extra, chosenField.checked))"
          />&ngsp;{{ extra }}</label>
        }
      </fieldset>
      <output>Speed: {{ speed }}, extras: {{ chosen.join(", ") || "none" }}</output>
    </section>
  `,
})
export default class Delivery {
  readonly speeds = input.required<string[]>();
  readonly extras = input.required<string[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly speed = signal("express");
  protected readonly chosen = signal<string[]>(["insurance"]);
  protected readonly toggle = toggle;
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
