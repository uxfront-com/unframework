import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface InvoiceTotalProps {
  quantity: number;
}

export default component$<
  InvoiceTotalProps &
    Omit<PropsOf<"div">, "quantity" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ quantity, class: className, style, ...attributes }) => {
  const refunded = useSignal(0);
  const total = useComputed$(() => {
    const units = quantity - refunded.value;
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  });

  const refund = $(() => {
    refunded.value = refunded.value + 3;
  });

  return (
    <div class={className} style={style} {...attributes}>
      <output>{`${total.value} after ${refunded.value} refunded`}</output>
      <button type="button" onClick$={refund}>
        Refund
      </button>
    </div>
  );
});
