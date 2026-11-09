import { type JSX, createMemo, createSignal } from "solid-js";

export interface InvoiceTotalProps {
  quantity: number;
}

export default function InvoiceTotal(
  props: InvoiceTotalProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [refunded, setRefunded] = createSignal(0);
  const total = createMemo(() => {
    const units = props.quantity - refunded();
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  });

  function refund() {
    setRefunded(refunded() + 3);
  }

  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <output>{total()}</output>
      <button type="button" onClick={refund}>
        Refund
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
