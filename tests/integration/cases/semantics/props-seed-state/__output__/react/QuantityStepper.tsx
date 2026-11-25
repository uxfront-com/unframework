import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export type QuantityStepperAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "initial" | "label" | "children"
>;

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
      {...attributes}
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
