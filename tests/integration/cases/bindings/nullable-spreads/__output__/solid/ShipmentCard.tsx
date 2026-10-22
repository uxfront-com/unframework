import { For, type JSX, Show, mergeProps } from "solid-js";

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

export default function ShipmentCard(
  rawProps: ShipmentCardProps & { class?: string; style?: JSX.CSSProperties },
) {
  const props = mergeProps({ eta: null } satisfies Partial<ShipmentCardProps>, rawProps);
  return (
    <section
      class={props.class ? `shipment-card ${props.class}` : "shipment-card"}
      aria-label={props.reference}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p id={props.carrier?.id} title={props.carrier?.title}>
        Carrier
      </p>
      <p id={props.eta?.id} title={props.eta?.title}>
        Estimated delivery
      </p>
      <p id={props.parcel.tag?.id} title={props.parcel.tag?.title}>
        {props.parcel.label}
      </p>
      <p
        id={(props.tracked ? props.tracking : undefined)?.id}
        title={(props.tracked ? props.tracking : undefined)?.title}
      >
        Live tracking
      </p>
      <ol>
        <For each={props.stops}>
          {(stop, index) => (
            <li id={stop?.id} title={stop?.title}>
              Stop {index() + 1}
            </li>
          )}
        </For>
      </ol>
      <Show when={props.signature}>
        {(signature) => (
          <p id={signature().id} title={signature().title}>
            Signed on delivery
          </p>
        )}
      </Show>
      <Show when={props.parcel.seal} fallback={<p>Not sealed</p>}>
        {(seal) => (
          <p id={seal().id} title={seal().title}>
            Sealed
          </p>
        )}
      </Show>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
