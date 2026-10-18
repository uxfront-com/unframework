import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default component$<QuantityStepperProps & { class?: ClassList; style?: CSSProperties }>(
  ({ initial, label, class: className, style }) => {
    const quantity = useSignal(initial);

    return (
      <div class={["quantity-stepper", className]} role="group" aria-label={label} style={style}>
        <output>{quantity.value}</output>
        <button type="button" aria-label={`Increase ${label}`} onClick$={() => quantity.value++}>
          +
        </button>
      </div>
    );
  },
);
