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
      {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
