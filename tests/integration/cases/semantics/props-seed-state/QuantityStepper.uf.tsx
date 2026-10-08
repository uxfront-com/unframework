import { ref } from "unframework";

export interface QuantityStepperProps {
  initial: number;
  label: string;
}

export default function QuantityStepper({ initial, label }: QuantityStepperProps) {
  const quantity = ref(initial);

  return (
    <div class="quantity-stepper" role="group" aria-label={label}>
      <output>{quantity.value}</output>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => quantity.value++}>
        +
      </button>
    </div>
  );
}
