import { formatPrice, pluralise } from "./format";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface PriceTagEvents {
  onOrder$?: QRL<(summary: string) => void>;
}

export default component$<
  { cents: number } & PriceTagEvents &
    Omit<PropsOf<"section">, "cents" | "onOrder$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ cents, onOrder$, class: className, style, ...attributes }) => {
  const quantity = useSignal(1);
  const total = useComputed$(() => formatPrice(cents * quantity.value));

  const order = $(() => {
    onOrder$?.(`${pluralise(quantity.value, "item")} for ${total.value}`);
  });

  return (
    <section class={["price-tag", className]} aria-label="Price" style={style} {...attributes}>
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
