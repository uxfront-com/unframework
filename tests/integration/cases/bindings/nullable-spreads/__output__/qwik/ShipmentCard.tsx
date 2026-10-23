import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

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

export default component$<ShipmentCardProps & { class?: ClassList; style?: CSSProperties }>(
  ({
    reference,
    carrier,
    eta = null,
    parcel,
    tracked,
    tracking,
    stops,
    signature,
    class: className,
    style,
    ...attributes
  }) => {
    return (
      <section
        class={["shipment-card", className]}
        aria-label={reference}
        {...scopeAttributes(attributes)}
        style={style}
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
        <p
          id={(tracked ? tracking : undefined)?.id}
          title={(tracked ? tracking : undefined)?.title}
        >
          Live tracking
        </p>
        <ol>
          {stops.map((stop, index) => (
            <li key={index} id={stop?.id} title={stop?.title}>
              Stop {index + 1}
            </li>
          ))}
        </ol>
        <>
          {signature ? (
            <p id={signature.id} title={signature.title}>
              Signed on delivery
            </p>
          ) : null}
        </>
        {!parcel.seal ? (
          <p>Not sealed</p>
        ) : (
          <p id={parcel.seal.id} title={parcel.seal.title}>
            Sealed
          </p>
        )}
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
