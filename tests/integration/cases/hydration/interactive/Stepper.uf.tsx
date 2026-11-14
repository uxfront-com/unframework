import { defineEmits, ref } from "@uxfront/unframework";

export interface StepperProps {
  start?: number;
}

// A count the first click after hydration changes, and an event it emits.
export default function Stepper({ start = 0 }: StepperProps) {
  const emit = defineEmits<{ change: [value: number] }>();

  const count = ref(start);

  function add() {
    count.value += 1;
    emit("change", count.value);
  }

  return (
    <div class="stepper">
      <output>{count.value}</output>
      <button type="button" onClick={add}>
        Add one
      </button>
    </div>
  );
}
