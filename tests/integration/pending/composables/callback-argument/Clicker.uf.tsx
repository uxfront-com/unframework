import { defineEmits, ref } from "unframework";

import { useCounter } from "./useCounter.uf.ts";

export default function Clicker() {
  const emit = defineEmits<{ limit: [count: number] }>();
  const message = ref("Keep going");
  const { count, increment, reset } = useCounter(3, (reached) => {
    message.value = `Reached ${reached}`;
    emit("limit", reached);
  });

  return (
    <section class="clicker" aria-label="Clicker">
      <p role="status">Count: {count.value}</p>
      <p>{message.value}</p>
      <button type="button" onClick={() => increment()}>
        Click
      </button>
      <button type="button" onClick={() => reset()}>
        Reset
      </button>
    </section>
  );
}
