import { cx } from "./_unframework/cx";
import { useCart } from "./useCart";
import type { ComponentPropsWithRef } from "react";

export interface CartEvents {
  onTotal?: (items: number) => void;
  onCleared?: (empty: boolean) => void;
}

export type CartAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "onTotal" | "onCleared" | "children"
>;

export default function Cart({
  onTotal,
  onCleared,
  className,
  style,
  ...attributes
}: CartEvents & CartAttributes) {
  const { items, currentItems, currentEmpty, add, clear } = useCart();

  function addTwiceAndReport() {
    add(1);
    add(2);
    onTotal?.(currentItems());
  }

  function clearAndReport() {
    clear();
    onCleared?.(currentEmpty());
  }

  return (
    <section className={cx("cart", className)} aria-label="Cart" style={style} {...attributes}>
      <p role="status">Items: {items}</p>
      <button type="button" onClick={addTwiceAndReport}>
        Add three
      </button>
      <button type="button" onClick={clearAndReport}>
        Clear
      </button>
    </section>
  );
}
