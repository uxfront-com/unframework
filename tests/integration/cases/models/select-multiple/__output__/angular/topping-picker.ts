import { isPlatformServer } from "@angular/common";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  signal,
} from "@angular/core";

/** A multiple select's selected values, as Vue's `vModelSelect` writes them (ADR-0054). */
function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
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
  selector: "uf-topping-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let toppings = this.toppings();
    <section aria-label="Pizza" [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
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
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
