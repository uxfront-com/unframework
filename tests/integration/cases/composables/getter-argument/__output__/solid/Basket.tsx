import { useTotal } from "./useTotal";
import { type JSX, createSignal } from "solid-js";

export default function Basket(
  props: { price: number } & { class?: string; style?: JSX.CSSProperties },
) {
  const [quantity, setQuantity] = createSignal(1);
  const { total, label } = useTotal(
    () => props.price,
    () => quantity(),
  );

  return (
    <section
      class={props.class ? `basket ${props.class}` : "basket"}
      aria-label="Basket"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">Total: {total()}</p>
      <p>{label()}</p>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        Add one
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
