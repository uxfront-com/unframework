import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { useCounter } from "./use-counter";
import { Component, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";

@Component({
  selector: "uf-clicker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let message = this.message();
    @let count = this.counter.count();
    <section
      class="clicker"
      aria-label="Clicker"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <p role="status">Count: {{ count }}</p>
      <p>{{ message }}</p>
      <button type="button" (click)="void counter.increment()">Add {{ counter.step }}</button>
      <button type="button" (click)="void counter.reset()">Reset</button>
    </section>
  `,
})
export default class Clicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly limit = output<number>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly message = signal("Keep going");
  protected readonly counter = useCounter(3, (reached) => {
    this.message.set(`Reached ${reached}`);
    this.limit.emit(reached);
  });
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
