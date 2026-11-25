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

export default function ShipmentCard({
  reference,
  carrier,
  eta = null,
  parcel,
  tracked,
  tracking,
  stops,
  signature,
}: ShipmentCardProps) {
  return (
    <section class="shipment-card" aria-label={reference}>
      <p {...carrier}>Carrier</p>
      <p {...eta}>Estimated delivery</p>
      <p {...parcel.tag}>{parcel.label}</p>
      <p {...(tracked ? tracking : undefined)}>Live tracking</p>
      <ol>
        {stops.map((stop, index) => (
          <li key={index} {...stop}>
            Stop {index + 1}
          </li>
        ))}
      </ol>
      {signature && <p {...signature}>Signed on delivery</p>}
      {!parcel.seal ? <p>Not sealed</p> : <p {...parcel.seal}>Sealed</p>}
    </section>
  );
}
