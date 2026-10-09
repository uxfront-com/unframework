import { defineModel } from "unframework";

export default function Stepper({ label }: { label: string }) {
  const value = defineModel<number>("value", { default: 0 });
  return (
    <div class="stepper">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => (value.value -= 1)}>
        -
      </button>
      <span>
        {label}: {value.value}
      </span>
      <button type="button" aria-label={`More ${label}`} onClick={() => (value.value += 1)}>
        +
      </button>
    </div>
  );
}
