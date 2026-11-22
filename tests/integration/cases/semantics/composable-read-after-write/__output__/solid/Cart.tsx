import { useCart } from "./useCart";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface CartEvents {
  onTotal?: (items: number) => void;
  onCleared?: (empty: boolean) => void;
}

export default function Cart(
  props: CartEvents & Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["onTotal", "onCleared", "class"]);

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
    <section class={props.class ? `cart ${props.class}` : "cart"} aria-label="Cart" {...others}>
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
