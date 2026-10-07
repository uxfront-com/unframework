import { defineEmits, ref, watch } from "unframework";

// Watch timing (ADR-0048): once per run of a handler, only on a change, the previous value of the
// last callback, a cleanup right before the next callback and on unmount, never on a run that
// finds the source unchanged; an immediate watcher's first callback at setup.
export default function Watchers() {
  const emit = defineEmits<{
    searched: [value: string, previous: string];
    cleaned: [value: string];
    total: [value: number, previous?: number];
  }>();

  const query = ref("");
  const low = ref(1);
  const high = ref(2);

  watch(query, (value, previous, onCleanup) => {
    emit("searched", value, previous);
    onCleanup(() => {
      emit("cleaned", value);
    });
  });

  watch(
    () => low.value + high.value,
    (value, previous) => {
      emit("total", value, previous);
    },
    { immediate: true },
  );

  function search(term: string) {
    query.value = term.toUpperCase();
    query.value = term;
  }

  function swap() {
    const first = low.value;
    low.value = high.value;
    high.value = first;
  }

  return (
    <section>
      <p role="status">{query.value}</p>
      <button type="button" onClick={() => search("boots")}>
        Boots
      </button>
      <button type="button" onClick={() => search("sandals")}>
        Sandals
      </button>
      <button type="button" onClick={swap}>
        Swap
      </button>
      <button type="button" onClick={() => (high.value += 1)}>
        Raise
      </button>
    </section>
  );
}
