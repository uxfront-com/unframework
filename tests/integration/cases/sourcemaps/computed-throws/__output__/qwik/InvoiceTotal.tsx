import {
  $,
  type CSSProperties,
  type ClassList,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface InvoiceTotalProps {
  quantity: number;
}

export default component$<InvoiceTotalProps & { class?: ClassList; style?: CSSProperties }>(
  ({ quantity, class: className, style, ...attributes }) => {
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
      <div {...scopeAttributes(attributes)} class={className} style={style}>
        <output>{total.value}</output>
        <button type="button" onClick$={refund}>
          Refund
        </button>
      </div>
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
