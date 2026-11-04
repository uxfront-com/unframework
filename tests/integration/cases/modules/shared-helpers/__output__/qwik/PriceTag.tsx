import { formatPrice, pluralise } from "./format";
import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface PriceTagEvents {
  onOrder$?: QRL<(summary: string) => void>;
}

export default component$<
  { cents: number } & PriceTagEvents & { class?: ClassList; style?: CSSProperties }
>(({ cents, onOrder$, class: className, style, ...attributes }) => {
  const quantity = useSignal(1);
  const total = useComputed$(() => formatPrice(cents * quantity.value));

  const order = $(() => {
    onOrder$?.(`${pluralise(quantity.value, "item")} for ${total.value}`);
  });

  return (
    <section
      class={["price-tag", className]}
      aria-label="Price"
      {...scopeAttributes(attributes)}
      style={style}
    >
      <p>Each: {formatPrice(cents)}</p>
      <p role="status">
        {pluralise(quantity.value, "item")}: {total.value}
      </p>
      <button type="button" onClick$={() => quantity.value++}>
        One more
      </button>
      <button type="button" onClick$={order}>
        Order
      </button>
    </section>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
