import { defineEmits, onUnmounted, ref, watch, watchEffect } from "unframework";

export default function SearchSession() {
  const emit = defineEmits<{
    unmounted: [];
    effectCleaned: [query: string];
    watchCleaned: [query: string];
    searched: [query: string, count: number];
    searchCleaned: [query: string];
    summary: [text: string];
  }>();

  const query = ref("");
  const results = ref<string[]>([]);

  onUnmounted(() => {
    emit("unmounted");
  });

  watchEffect((onCleanup) => {
    const value = query.value;
    onCleanup(() => {
      emit("effectCleaned", value);
    });
  });

  watch(
    query,
    (value, previous, onCleanup) => {
      onCleanup(() => {
        emit("watchCleaned", value);
      });
    },
    { immediate: true },
  );

  watch(query, (value) => {
    results.value = value === "" ? [] : [value, `${value} docs`];
  });

  watch(
    query,
    (value, previous, onCleanup) => {
      emit("searched", value, results.value.length);
      onCleanup(() => {
        emit("searchCleaned", value);
      });
    },
    { flush: "post" },
  );

  watchEffect(() => {
    emit("summary", `${results.value.length} results for "${query.value}"`);
  });

  return (
    <section class="search-session" aria-label="Search">
      <label>
        Query
        <input
          name="query"
          onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <ul aria-label="Results">
        {results.value.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
      <button type="button" onClick={() => (results.value = [])}>
        Clear results
      </button>
    </section>
  );
}
