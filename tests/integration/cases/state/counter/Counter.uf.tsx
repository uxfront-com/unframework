import { computed, defineEmits, ref } from "unframework";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export default function Counter({ initial = 0, step = 1 }: CounterProps) {
  const emit = defineEmits<{ change: [value: number] }>();

  const count = ref(initial);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value += step;
    emit("change", count.value);
  }

  return (
    <div class="counter">
      <output>{count.value}</output>
      {doubled.value > 10 ? <span>Big</span> : null}
      <button type="button" onClick={increment}>
        +{step}
      </button>
    </div>
  );
}
