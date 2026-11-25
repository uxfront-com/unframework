import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface InvoiceTotalProps {
  quantity: number;
}

export default function InvoiceTotal(
  props: InvoiceTotalProps &
    Omit<ComponentProps<"div">, "quantity" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "quantity");

  const [refunded, setRefunded] = createState(0);
  const total = () => {
    const units = props.quantity - refunded();
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  };

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
