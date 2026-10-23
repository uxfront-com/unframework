import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  signal,
} from "@angular/core";

/**
 * A checkbox group's array once a box is checked or unchecked, as Vue's `vModelCheckbox`
 * writes it (ADR-0054): a new array with the box's value added or removed.
 */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked) return index === -1 ? [...values, value] : [...values];
  return values.filter((_, at) => at !== index);
}

/** The scope attributes taken off each host, for the roots its component renders later. */
const scopes = new WeakMap<Element, string[]>();

/**
 * Gives a root node of its component the scope attributes the component's styled parents put on
 * its host (ADR-0063), and takes them off the host, which keeps only `display: contents`.
 */
@Directive({ selector: "[ufScope]" })
export class ScopeAttributes implements OnInit {
  readonly ufScope = input.required<HTMLElement>();
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const host = this.ufScope();
    let names = scopes.get(host);
    if (!names) {
      names = host.getAttributeNames().filter((name) => name.startsWith("data-uf-"));
      for (const name of names) this.renderer.removeAttribute(host, name);
      scopes.set(host, names);
    }
    for (const name of names) this.renderer.setAttribute(this.element.nativeElement, name, "");
  }
}

@Component({
  selector: "uf-drinks",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let drinks = this.drinks();
    <fieldset [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
