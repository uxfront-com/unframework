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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
