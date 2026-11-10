import { type CSSProperties, useMemo, useRef, useState } from "react";

export interface InvoiceTotalProps {
  quantity: number;
}

export interface InvoiceTotalAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function InvoiceTotal({
  quantity,
  className,
  style,
  ...attributes
}: InvoiceTotalProps & InvoiceTotalAttributes) {
  const [refunded, setRefunded] = useState(0);
  const refundedRef = useRef(refunded);
  const total = useMemo(() => {
    const units = quantity - refunded;
    if (units < 0) {
      throw new Error("The total is negative");
    }
    return units * 5;
  }, [quantity, refunded]);

  function refund() {
    refundedRef.current = refundedRef.current + 3;
    setRefunded(refundedRef.current);
  }

  return (
    <div className={className} style={style} {...scopeAttributes(attributes)}>
      <output>{`${total} after ${refunded} refunded`}</output>
      <button type="button" onClick={refund}>
        Refund
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
