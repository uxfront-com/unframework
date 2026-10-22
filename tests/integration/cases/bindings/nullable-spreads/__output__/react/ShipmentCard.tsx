import type { CSSProperties } from "react";

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

export interface ShipmentCardAttributes {
  className?: string;
  style?: CSSProperties;
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
  className,
  style,
  ...attributes
}: ShipmentCardProps & ShipmentCardAttributes) {
  return (
    <section
      className={cx("shipment-card", className)}
      aria-label={reference}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p id={carrier?.id} title={carrier?.title}>
        Carrier
      </p>
      <p id={eta?.id} title={eta?.title}>
        Estimated delivery
      </p>
      <p id={parcel.tag?.id} title={parcel.tag?.title}>
        {parcel.label}
      </p>
      <p id={(tracked ? tracking : undefined)?.id} title={(tracked ? tracking : undefined)?.title}>
        Live tracking
      </p>
      <ol>
        {stops.map((stop, index) => (
          <li key={index} id={stop?.id} title={stop?.title}>
            Stop {index + 1}
          </li>
        ))}
      </ol>
      {signature ? (
        <p id={signature.id} title={signature.title}>
          Signed on delivery
        </p>
      ) : null}
      {!parcel.seal ? (
        <p>Not sealed</p>
      ) : (
        <p id={parcel.seal.id} title={parcel.seal.title}>
          Sealed
        </p>
      )}
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
