import {
  Component,
  Directive,
  ElementRef,
  type OnInit,
  Renderer2,
  inject,
  input,
} from "@angular/core";

interface LabelAttributes {
  id: string;
  title?: string;
}

interface Parcel {
  label: string;
  tag?: LabelAttributes;
  seal?: LabelAttributes;
}

export interface ShipmentCardProps {
  reference: string;
  carrier: LabelAttributes | null;
  eta?: LabelAttributes | null;
  parcel: Parcel;
  tracked: boolean;
  tracking: LabelAttributes;
  stops: (LabelAttributes | undefined)[];
  signature?: LabelAttributes;
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
  selector: "uf-shipment-card",
  imports: [ScopeAttributes],
  host: { "[attr.class]": "null", "[attr.style]": "'display: contents;'" },
  preserveWhitespaces: false,
  template: `
    @let reference = this.reference();
    @let carrier = this.carrier();
    @let eta = this.eta();
    @let parcel = this.parcel();
    @let tracked = this.tracked();
    @let tracking = this.tracking();
    @let stops = this.stops();
    @let signature = this.signature();
    <section
      class="shipment-card"
      [attr.aria-label]="reference"
      [class]="this.class()"
      [style]="this.style()"
      [ufScope]="this.host"
    >
      <p [attr.id]="carrier?.id" [attr.title]="carrier?.title">Carrier</p>
      <p [attr.id]="eta?.id" [attr.title]="eta?.title">Estimated delivery</p>
      <p [attr.id]="parcel.tag?.id" [attr.title]="parcel.tag?.title">{{ parcel.label }}</p>
      <p
        [attr.id]="(tracked ? tracking : undefined)?.id"
        [attr.title]="(tracked ? tracking : undefined)?.title"
      >Live tracking</p>
      <ol>
        @for (stop of stops; track index; let index = $index) {
          <li [attr.id]="stop?.id" [attr.title]="stop?.title">Stop {{ index + 1 }}</li>
        }
      </ol>
      @if (signature) {
        <p [attr.id]="signature.id" [attr.title]="signature.title">Signed on delivery</p>
      }
      @if (!parcel.seal) {
        <p>Not sealed</p>
      } @else {
        <p [attr.id]="parcel.seal.id" [attr.title]="parcel.seal.title">Sealed</p>
      }
    </section>
  `,
})
export default class ShipmentCard {
  readonly reference = input.required<string>();
  readonly carrier = input.required<LabelAttributes | null>();
  readonly eta = input<LabelAttributes | null, LabelAttributes | null | undefined>(null, {
    transform: (value) => (value === undefined ? null : value),
  });
  readonly parcel = input.required<Parcel>();
  readonly tracked = input.required<boolean>();
  readonly tracking = input.required<LabelAttributes>();
  readonly stops = input.required<(LabelAttributes | undefined)[]>();
  readonly signature = input<LabelAttributes>();
  readonly class = input<string>();
  readonly style = input<Record<string, string | null | undefined>>();
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
