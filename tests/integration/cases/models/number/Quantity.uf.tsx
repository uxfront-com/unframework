import { ref } from "unframework";

export default function Quantity() {
  const count = ref(2);
  const volume = ref(5);
  return (
    <section aria-label="Order">
      <input type="number" aria-label="Count" min="0" v-model={count.value} />
      <input type="range" aria-label="Volume" min="0" max="10" v-model={volume.value} />
      <output>
        Next: {count.value + 1}, volume {volume.value + 1}
      </output>
      <button type="button" onClick={() => (count.value = 10)}>
        Ten
      </button>
    </section>
  );
}
