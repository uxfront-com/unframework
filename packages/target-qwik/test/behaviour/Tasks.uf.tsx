import {
  computed,
  defineEmits,
  onMounted,
  onUnmounted,
  ref,
  watch,
  watchEffect,
} from "unframework";

// Tasks (ADR-0048): hooks and watchers in source order, one reading a computed declared later
// through a helper; an async watcher a new change overtakes, which drops the earlier run at once;
// a `watchEffect` that runs once per change though a watcher writes what it reads; and every
// cleanup before `onUnmounted`.
export default function Tasks() {
  const emit = defineEmits<{
    order: [line: string];
    looked: [query: string];
    dropped: [query: string];
    summary: [text: string];
    teardown: [line: string];
  }>();

  const query = ref("");
  const results = ref<string[]>([]);
  const answer = ref("");
  let reply: ((text: string) => void) | undefined;

  onMounted(() => {
    emit("order", `first ${describe()}`);
  });

  onMounted(() => {
    emit("order", "second");
  });

  watch(query, async (value, previous, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
      emit("dropped", value);
    });
    emit("looked", value);
    const text = await new Promise<string>((resolve) => {
      reply = resolve;
    });
    if (!cancelled) answer.value = `${value}: ${text}`;
  });

  watch(query, (value) => {
    results.value = value === "" ? [] : [value, `${value} docs`];
  });

  watchEffect((onCleanup) => {
    emit("summary", `${results.value.length} for "${query.value}"`);
    onCleanup(() => emit("teardown", "effect"));
  });

  onUnmounted(() => {
    emit("teardown", "unmounted");
  });

  const doubled = computed(() => results.value.length * 2);

  function describe(): string {
    return `doubled ${doubled.value}`;
  }

  return (
    <section aria-label="Tasks">
      <button type="button" onClick={() => (query.value = "ann")}>
        Ann
      </button>
      <button type="button" onClick={() => (query.value = "anna")}>
        Anna
      </button>
      <button type="button" onClick={() => reply?.("found")}>
        Answer
      </button>
      <p role="status">{answer.value}</p>
      <ul aria-label="Results">
        {results.value.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </section>
  );
}
