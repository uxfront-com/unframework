import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { Component, ElementRef, inject, input, signal, viewChild } from "@angular/core";

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

@Component({
  selector: "uf-stepper",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let value = this.value();
    <section
      class="stepper"
      aria-label="Stepper"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">{{ caption(value) }}</p>
      <ul>
        @for (step of STEPS; track step) {
          <li>
            <button type="button" (click)="add(step)">Add {{ step }}</button>
          </li>
        }
      </ul>
    </section>
  `,
})
export default class Stepper {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly value = signal(START);
  protected readonly STEPS = STEPS;
  protected readonly caption = caption;

  protected add(step: number) {
    this.value.set(Math.min(LIMITS.max, this.value() + step));
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
