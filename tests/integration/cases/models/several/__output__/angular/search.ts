import PriceRange from "./price-range";
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
  selector: "uf-search",
  imports: [PriceRange, ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let low = this.low();
    @let high = this.high();
    <section
      aria-label="Search"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <uf-price-range [label]="'Price'" [(min)]="this.low" [(max)]="this.high" />
      <output>Between {{ low }} and {{ high }}</output>
      <button type="button" (click)="onCheaper()">Cheaper</button>
    </section>
  `,
})
export default class Search {
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly low = signal(20);
  protected readonly high = signal(50);

  protected onCheaper() {
    this.high.set(40);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
