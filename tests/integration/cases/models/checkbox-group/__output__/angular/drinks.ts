import { Component, input, signal } from "@angular/core";

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
  selector: "uf-drinks",
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let drinks = this.drinks();
    <fieldset [class]="this.class()" [style]="this.style()">
      <legend>Drinks</legend>
      <label><input
        type="checkbox"
        value="tea"
        #drinksField
        [checked]="this.drinks().includes('tea')"
        (change)="this.drinks.set(toggle(this.drinks(), 'tea', drinksField.checked))"
      /> Tea</label>
      <label><input
        type="checkbox"
        value="coffee"
        #drinksField_1
        [checked]="this.drinks().includes('coffee')"
        (change)="this.drinks.set(toggle(this.drinks(), 'coffee', drinksField_1.checked))"
      /> Coffee</label>
      <label><input
        type="checkbox"
        value="juice"
        #drinksField_2
        [checked]="this.drinks().includes('juice')"
        (change)="this.drinks.set(toggle(this.drinks(), 'juice', drinksField_2.checked))"
      /> Juice</label>
      <output>Ordered: {{ drinks.join(", ") || "nothing" }}</output>
      <button type="button" (click)="onOnlyJuice()">Only juice</button>
    </fieldset>
  `,
})
export default class Drinks {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly drinks = signal<string[]>(["tea"]);
  protected readonly toggle = toggle;

  protected onOnlyJuice() {
    this.drinks.set(["juice"]);
  }
}
