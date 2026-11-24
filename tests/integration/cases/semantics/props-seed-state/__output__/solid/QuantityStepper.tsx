import { type ComponentProps, type JSX, createSignal, splitProps, untrack } from "solid-js";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default function QuantityStepper(
  props: QuantityStepperProps &
    Omit<ComponentProps<"div">, "initial" | "label" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["initial", "label", "class"]);

  const [quantity, setQuantity] = createSignal(untrack(() => props.initial));

  return (
    <div
      class={props.class ? `quantity-stepper ${props.class}` : "quantity-stepper"}
      role="group"
      aria-label={props.label}
      {...others}
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
