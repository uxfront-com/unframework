import { createSignal, untrack } from "solid-js";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default function QuantityStepper(props: QuantityStepperProps) {
  const [quantity, setQuantity] = createSignal(untrack(() => props.initial));

  return (
    <div class="quantity-stepper" role="group" aria-label={props.label}>
      <output>{quantity()}</output>
      <button
        type="button"
        aria-label={`Increase ${props.label}`}
        onClick={() => setQuantity(quantity() + 1)}
      >
        +
      </button>
    </div>
  );
}
