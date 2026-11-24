import { useCart } from "./useCart";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface CartEvents {
  onTotal?: (items: number) => void;
  onCleared?: (empty: boolean) => void;
}

export default function Cart(
  props: CartEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onTotal", "onCleared", "class");

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
