import { useCart } from "./useCart";
import { $, type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface CartEvents {
  onTotal$?: QRL<(items: number) => void>;
  onCleared$?: QRL<(empty: boolean) => void>;
}

export default component$<CartEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onTotal$, onCleared$, class: className, style, ...attributes }) => {
    const { items, empty, add, clear } = useCart();

    const addTwiceAndReport = $(async () => {
      await add(1);
      await add(2);
      onTotal$?.(items.value);
    });

    const clearAndReport = $(async () => {
      await clear();
      onCleared$?.(empty.value);
    });

    return (
      <section
        class={["cart", className]}
        aria-label="Cart"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">Items: {items.value}</p>
        <button type="button" onClick$={addTwiceAndReport}>
          Add three
        </button>
        <button type="button" onClick$={clearAndReport}>
          Clear
        </button>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
