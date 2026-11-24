import { type ComponentProps, type JSX, createMemo, createSignal, splitProps } from "solid-js";

export interface InvoiceTotalProps {
  quantity: number;
}

export default function InvoiceTotal(
  props: InvoiceTotalProps &
    Omit<ComponentProps<"div">, "quantity" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["quantity"]);

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
    <div {...others}>
      <output>{`${total()} after ${refunded()} refunded`}</output>
      <button type="button" onClick={refund}>
        Refund
      </button>
    </div>
  );
}
