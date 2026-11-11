import { computed, ref } from "@uxfront/unframework";

import type { CounterProps } from "./types";

export default function Counter({ initial = 0, step = 1 }: CounterProps) {
  const count = ref(initial);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value += step;
  }

  return (
    <div class="counter">
      <output>{count.value}</output>
      <span>Doubled: {doubled.value}</span>
      <button type="button" onClick={increment}>
        Add {step}
      </button>
    </div>
  );
}
