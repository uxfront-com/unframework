import { formatPrice, pluralise } from "./format";
import { type JSX, createMemo, createSignal } from "solid-js";

export interface PriceTagEvents {
  onOrder?: (summary: string) => void;
}

export default function PriceTag(
  props: { cents: number } & PriceTagEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [quantity, setQuantity] = createSignal(1);
  const total = createMemo(() => formatPrice(props.cents * quantity()));

  function order() {
    props.onOrder?.(`${pluralise(quantity(), "item")} for ${total()}`);
  }

  return (
    <section
      class={props.class ? `price-tag ${props.class}` : "price-tag"}
      aria-label="Price"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p>Each: {formatPrice(props.cents)}</p>
      <p role="status">
        {pluralise(quantity(), "item")}: {total()}
      </p>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        One more
      </button>
      <button type="button" onClick={order}>
        Order
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
