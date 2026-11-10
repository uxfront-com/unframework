import { useCart } from "./use-cart";
import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
  output,
} from "@angular/core";

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
  selector: "uf-cart",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let items = this.cart.items();
    <section
      class="cart"
      aria-label="Cart"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p role="status">Items: {{ items }}</p>
      <button type="button" (click)="addTwiceAndReport()">Add three</button>
      <button type="button" (click)="clearAndReport()">Clear</button>
    </section>
  `,
})
export default class Cart {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  readonly total = output<number>();
  readonly cleared = output<boolean>();
  protected readonly cart = useCart();

  protected addTwiceAndReport() {
    this.cart.add(1);
    this.cart.add(2);
    this.total.emit(this.cart.items());
  }

  protected clearAndReport() {
    this.cart.clear();
    this.cleared.emit(this.cart.empty());
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
