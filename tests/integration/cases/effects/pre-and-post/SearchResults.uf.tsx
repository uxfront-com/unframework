import { defineEmits, nextTick, onMounted, ref, useTemplateRef, watch } from "unframework";

export default function SearchResults() {
  const emit = defineEmits<{
    ready: [text: string];
    rendered: [count: number];
    shown: [text: string];
  }>();

  const status = ref("Loading");
  const query = ref("");
  const results = ref<string[]>([]);
  const count = ref(0);
  const doubled = ref(0);
  const banner = useTemplateRef<HTMLParagraphElement>();
  const list = useTemplateRef<HTMLUListElement>();
  const total = useTemplateRef<HTMLOutputElement>();

  watch(query, (value) => {
    results.value = value === "" ? [] : [value, `${value} docs`];
  });

  watch(
    query,
    () => {
      emit("rendered", list.value?.childElementCount ?? -1);
    },
    { flush: "post" },
  );

  watch(count, (value) => {
    doubled.value = value * 2;
  });

  onMounted(async () => {
    status.value = "Ready";
    await nextTick();
    emit("ready", banner.value?.textContent ?? "");
  });

  async function addOne() {
    count.value += 1;
    await nextTick();
    emit("shown", total.value?.textContent ?? "");
  }

  return (
    <section class="search-results" aria-label="Search">
      <p ref={banner}>{status.value}</p>
      <label>
        Query
        <input
          name="query"
          onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <ul ref={list} aria-label="Results">
        {results.value.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
      <output ref={total}>{doubled.value}</output>
      <button type="button" onClick={addOne}>
        Add one
      </button>
    </section>
  );
}
