import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import Display from "./display";
import {
  Component,
  ElementRef,
  InjectionToken,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

export const CountKey = new InjectionToken<{ readonly value: number }>("uf.count");

/** A ref as a descendant injects it (ADR-0054): its value through a getter, read as it changes. */
function refObject<T>(ref: () => T): { readonly value: T } {
  return {
    get value() {
      return ref();
    },
  };
}

@Component({
  selector: "uf-counter",
  imports: [Display, ScopeAttributes, Fallthrough],
  providers: [{ provide: CountKey, useFactory: () => refObject(inject(Counter).count) }],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    <section
      aria-label="Counter"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <uf-display />
      <button type="button" (click)="onAddOne()">Add one</button>
    </section>
  `,
})
export default class Counter {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  readonly count = signal(1);

  protected onAddOne() {
    this.count.update((count) => count + 1);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
