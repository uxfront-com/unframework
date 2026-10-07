import { component$, useSignal } from "@qwik.dev/core";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default component$<QuantityStepperProps>(({ initial, label }) => {
  const quantity = useSignal(initial);

  return (
    <div class="quantity-stepper" role="group" aria-label={label}>
      <output>{quantity.value}</output>
      <button type="button" aria-label={`Increase ${label}`} onClick$={() => quantity.value++}>
        +
      </button>
    </div>
  );
});
