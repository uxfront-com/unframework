import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
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
  selector: "uf-shipping-label",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let recipient = this.recipient();
    @let street = this.street();
    @let city = this.city();
    @let postcode = this.postcode();
    <article
      class="shipping-label"
      aria-label="Shipping label"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p><strong>To:</strong>&ngsp;{{ recipient }}</p>
      <p>
        <span class="shipping-label-city">{{ city }}</span>&ngsp;<span
          class="shipping-label-postcode"
        >{{ postcode }}</span>&ngsp;<span class="shipping-label-country">United Kingdom</span>
      </p>
      <p>{{ "\\u0020\\u0020Handle with care " }}</p>
      <pre>{{ recipient }}
{{ street }}
{{ city + "\\u0020\\u0020" + postcode }}</pre>
      <pre>Parcel:	1 of 2
Weight:	2.5 kg</pre>
      <p>Sent by <em>Unframework Ltd</em>, on two
lines.</p>
    </article>
  `,
})
export default class ShippingLabel {
  readonly recipient = input.required<string>();
  readonly street = input.required<string>();
  readonly city = input.required<string>();
  readonly postcode = input.required<string>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
