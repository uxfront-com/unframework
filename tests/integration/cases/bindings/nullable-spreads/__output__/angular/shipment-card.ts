import { Component, input } from "@angular/core";

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

@Component({
  selector: "uf-shipment-card",
  host: { style: "display: contents" },
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
    <section class="shipment-card" [attr.aria-label]="reference">
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
}
