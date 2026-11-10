import { useCart } from "./useCart";
import type { JSX } from "solid-js";

export interface CartEvents {
  onTotal?: (items: number) => void;
  onCleared?: (empty: boolean) => void;
}

export default function Cart(props: CartEvents & { class?: string; style?: JSX.CSSProperties }) {
  const { items, empty, add, clear } = useCart();

  function addTwiceAndReport() {
    add(1);
    add(2);
    props.onTotal?.(items());
  }

  function clearAndReport() {
    clear();
    props.onCleared?.(empty());
  }

  return (
    <section
      class={props.class ? `cart ${props.class}` : "cart"}
      aria-label="Cart"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">Items: {items()}</p>
      <button type="button" onClick={addTwiceAndReport}>
        Add three
      </button>
      <button type="button" onClick={clearAndReport}>
        Clear
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
