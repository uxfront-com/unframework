import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

type Availability = "in-stock" | "backorder" | "discontinued";

interface Finish {
  sku: string;
  label: string;
}

export interface ProductSpecProps {
  name: string;
  availability: Availability;
  size: { width: number; depth: number; unit: "cm" | "in" };
  finishes: Finish[];
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
  selector: "uf-product-spec",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let name = this.name();
    @let availability = this.availability();
    @let size = this.size();
    @let finishes = this.finishes();
    <section
      class="product-spec"
      [attr.aria-label]="name"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <h2>{{ name }}</h2>
      <dl>
        <dt>Availability</dt>
        <dd>{{ availability }}</dd>
        <dt>Size</dt>
        <dd>{{ size.width }} × {{ size.depth }}&ngsp;{{ size.unit }}</dd>
      </dl>
      <ul>
        @for (finish of finishes; track finish.sku) {
          <li>{{ finish.label }} ({{ finish.sku }})</li>
        }
      </ul>
    </section>
  `,
})
export default class ProductSpec {
  readonly name = input.required<string>();
  readonly availability = input.required<Availability>();
  readonly size = input.required<{ width: number; depth: number; unit: "cm" | "in" }>();
  readonly finishes = input.required<Finish[]>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
