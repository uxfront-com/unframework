import { defineEmits } from "unframework";

import { useCart } from "./useCart.uf.ts";

export default function Cart() {
  const emit = defineEmits<{
    total: [items: number];
    cleared: [empty: boolean];
  }>();
  const { items, empty, add, clear } = useCart();

  function addTwiceAndReport() {
    add(1);
    add(2);
    emit("total", items.value);
  }

  function clearAndReport() {
    clear();
    emit("cleared", empty.value);
  }

  return (
    <section class="cart" aria-label="Cart">
      <p role="status">Items: {items.value}</p>
      <button type="button" onClick={addTwiceAndReport}>
        Add three
      </button>
      <button type="button" onClick={clearAndReport}>
        Clear
      </button>
    </section>
  );
}
