import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
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
  selector: "uf-fruit-picker",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let fruits = this.fruits();
    @let selected = this.selected();
    @let basket = this.basket();
    <section
      class="fruit-picker"
      aria-label="Fruit"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <ul aria-label="Fruits">
        @for (fruit of fruits; track fruit.name) {
          <li>
            <button
              type="button"
              [attr.aria-pressed]="fruit === selected"
              (click)="pick(fruit)"
            >{{ fruit.name }}</button>
          </li>
        }
      </ul>
      <button type="button" (click)="keep()">Keep a copy</button>
      <ol aria-label="Basket">
        @for (fruit of basket; track index; let index = $index) {
          <li>{{ fruit.name + " (" + fruit.colour + ")" }}</li>
        }
      </ol>
    </section>
  `,
})
export default class FruitPicker {
  readonly fruits = input.required<Fruit[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly kept = output<[name: string, colour: string]>();
  protected readonly selected = signal<Fruit | null>(null);
  protected readonly basket = signal<Fruit[]>([]);

  protected pick(fruit: Fruit) {
    this.selected.set(fruit);
  }

  protected keep() {
    const current = this.selected();
    if (!current) return;
    const copy = structuredClone(current);
    this.basket.set([...this.basket(), copy]);
    this.kept.emit([copy.name, copy.colour]);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
