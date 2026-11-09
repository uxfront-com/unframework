import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";

export interface InvoiceTotalProps {
  quantity: number;
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
  selector: "uf-invoice-total",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let total = this.total();
    <div [class]="this.class()" [style]="this.style()" [ufScope]="this.host">
      <output>{{ total }}</output>
      <button type="button" (click)="refund()">Refund</button>
    </div>
  `,
})
export default class InvoiceTotal {
  readonly quantity = input.required<number>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  private readonly refunded = signal(0);
  protected readonly total = computed(() => {
    const units = this.quantity() - this.refunded();
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  });

  protected refund() {
    this.refunded.set(this.refunded() + 3);
  }
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
