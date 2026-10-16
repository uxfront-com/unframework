import { isPlatformServer } from "@angular/common";
import { Component, PLATFORM_ID, inject, input, signal } from "@angular/core";

/** A multiple select's selected values, as Vue's `vModelSelect` writes them (ADR-0054). */
function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
}

@Component({
  selector: "uf-topping-picker",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let toppings = this.toppings();
    <section aria-label="Pizza" [class]="this.class()" [style]="this.style()">
      <label>Toppings <select
        multiple
        #toppingsField
        (change)="this.toppings.set(selectedValues(toppingsField))"
      ><option
        value="cheese"
        [selected]="this.toppings().includes('cheese')" [defaultSelected]="onServer && this.toppings().includes('cheese')"
      >Cheese</option><option
        value="olives"
        [selected]="this.toppings().includes('olives')" [defaultSelected]="onServer && this.toppings().includes('olives')"
      >Olives</option><option
        value="basil"
        [selected]="this.toppings().includes('basil')" [defaultSelected]="onServer && this.toppings().includes('basil')"
      >Basil</option></select></label>
      <output>On top: {{ toppings.join(", ") || "nothing" }}</output>
      <button type="button" (click)="onGreen()">Green</button>
    </section>
  `,
})
export default class ToppingPicker {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly toppings = signal<string[]>(["cheese"]);
  protected readonly onServer = isPlatformServer(inject(PLATFORM_ID));
  protected readonly selectedValues = selectedValues;

  protected onGreen() {
    this.toppings.set(["basil", "olives"]);
  }
}
