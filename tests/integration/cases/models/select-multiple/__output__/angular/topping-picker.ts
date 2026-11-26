import { Fallthrough } from "./_unframework/Fallthrough";
import type { Listeners } from "./_unframework/Listeners";
import { ScopeAttributes } from "./_unframework/ScopeAttributes";
import { isPlatformServer } from "@angular/common";
import {
  Component,
  ElementRef,
  PLATFORM_ID,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";

/** A multiple select's selected values, as Vue's `vModelSelect` writes them (ADR-0054). */
function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
}

@Component({
  selector: "uf-topping-picker",
  imports: [ScopeAttributes, Fallthrough],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let toppings = this.toppings();
    <section
      aria-label="Pizza"
      [class]="this.class()"
      [style]="this.style()"
      [ufFallthrough]="{ attributes: this.ufAttributes(), listeners: this.ufListeners() }"
      [ufScope]="this.host"
      #ufElement
    >
      <label>Toppings <select
        multiple
        #toppingsField
        (change)="this.toppings.set(selectedValues(toppingsField))"
      ><option
        value="cheese"
        [defaultSelected]="onServer && this.toppings().includes('cheese')" [selected]="this.toppings().includes('cheese')"
      >Cheese</option><option
        value="olives"
        [defaultSelected]="onServer && this.toppings().includes('olives')" [selected]="this.toppings().includes('olives')"
      >Olives</option><option
        value="basil"
        [defaultSelected]="onServer && this.toppings().includes('basil')" [selected]="this.toppings().includes('basil')"
      >Basil</option></select></label>
      <output>On top: {{ toppings.join(", ") || "nothing" }}</output>
      <button type="button" (click)="onGreen()">Green</button>
    </section>
  `,
})
export default class ToppingPicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly ufAttributes = input<Record<string, unknown>>();
  readonly ufListeners = input<Listeners>();
  readonly ufElement = viewChild<ElementRef<HTMLElement>>("ufElement");
  protected readonly toppings = signal<string[]>(["cheese"]);
  protected readonly onServer = isPlatformServer(inject(PLATFORM_ID));
  protected readonly selectedValues = selectedValues;

  protected onGreen() {
    this.toppings.set(["basil", "olives"]);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
