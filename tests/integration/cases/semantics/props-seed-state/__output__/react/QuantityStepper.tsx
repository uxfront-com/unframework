import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef, useState } from "react";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export interface QuantityStepperAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function QuantityStepper({
  initial,
  label,
  className,
  style,
  ...attributes
}: QuantityStepperProps & QuantityStepperAttributes) {
  const [quantity, setQuantity] = useState(initial);
  const quantityRef = useRef(quantity);

  return (
    <div
      className={cx("quantity-stepper", className)}
      role="group"
      aria-label={label}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <output>{quantity}</output>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => {
          quantityRef.current++;
          setQuantity(quantityRef.current);
        }}
      >
        +
      </button>
    </div>
  );
}
