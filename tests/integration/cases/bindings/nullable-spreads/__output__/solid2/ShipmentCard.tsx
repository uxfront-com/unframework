import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, merge, omit } from "solid-js";

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
  rawProps: ShipmentCardProps &
    Omit<
      ComponentProps<"section">,
      | "reference"
      | "carrier"
      | "eta"
      | "parcel"
      | "tracked"
      | "tracking"
      | "stops"
      | "signature"
      | "class"
      | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get eta() {
      return rawProps.eta === undefined ? null : rawProps.eta;
    },
  });
  const others = omit(
    props,
    "reference",
    "carrier",
    "eta",
    "parcel",
    "tracked",
    "tracking",
    "stops",
    "signature",
    "class",
  );

  return (
    <section
      class={props.class ? `shipment-card ${props.class}` : "shipment-card"}
      aria-label={props.reference}
      {...others}
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
        <KeyedFor each={props.stops} by={(stop, index) => index}>
          {(stop) => (
            <li id={stop.value?.id} title={stop.value?.title}>
              Stop {stop.index + 1}
            </li>
          )}
        </KeyedFor>
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
