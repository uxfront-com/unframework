import { type JSX, createSignal, untrack } from "solid-js";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default function QuantityStepper(
  props: QuantityStepperProps & { class?: string; style?: JSX.CSSProperties },
) {
  const [quantity, setQuantity] = createSignal(untrack(() => props.initial));

  return (
    <div
      class={props.class ? `quantity-stepper ${props.class}` : "quantity-stepper"}
      role="group"
      aria-label={props.label}
      style={props.style}
    >
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
