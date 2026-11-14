import { type Accessor, For, type JSX, Show, createMemo, mergeProps, untrack } from "solid-js";

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
        <KeyedFor each={props.stops} by={(stop, index) => index}>
          {(stop, index) => (
            <li id={stop()?.id} title={stop()?.title}>
              Stop {index() + 1}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
