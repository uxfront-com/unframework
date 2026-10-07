import { useRef, useState } from "react";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default function QuantityStepper({ initial, label }: QuantityStepperProps) {
  const [quantity, setQuantity] = useState(initial);
  const quantityRef = useRef(quantity);

  return (
    <div className="quantity-stepper" role="group" aria-label={label}>
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
