import { onMounted, ref, watch } from "unframework";

import { useTracked } from "./useTracked.uf.ts";

export default function Timeline() {
  const entries = ref<string[]>([]);

  function record(entry: string) {
    entries.value = [...entries.value, entry];
  }

  onMounted(() => record("caller mounted first"));

  const { count, increment } = useTracked((entry) => record(entry));

  watch(
    () => count.value,
    () => record("caller watcher"),
  );

  onMounted(() => record("caller mounted last"));

  return (
    <section class="timeline" aria-label="Timeline">
      <p role="status">Count: {count.value}</p>
      <button type="button" onClick={() => increment()}>
        Increment
      </button>
      <ol>
        {entries.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
