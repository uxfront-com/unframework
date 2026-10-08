import { $, type QRL, component$, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";

export interface SearchResultsEvents {
  onReady$?: QRL<(text: string) => void>;
  onRendered$?: QRL<(count: number) => void>;
  onShown$?: QRL<(text: string) => void>;
}

export default component$<SearchResultsEvents>(({ onReady$, onRendered$, onShown$ }) => {
  const status = useSignal("Loading");
  const query = useSignal("");
  const results = useSignal<string[]>([]);
  const count = useSignal(0);
  const doubled = useSignal(0);
  const banner = useSignal<HTMLParagraphElement>();
  const list = useSignal<HTMLUListElement>();
  const total = useSignal<HTMLOutputElement>();

  const previousQuery = useSignal(() => query.value);
  useTask$(
    ({ track }) => {
      const value = track(query);
      if (Object.is(value, previousQuery.value)) return;
      previousQuery.value = value;
      results.value = value === "" ? [] : [value, `${value} docs`];
    },
    { deferUpdates: false },
  );

  const previousQuery_1 = useSignal(() => query.value);
  useVisibleTask$(
    ({ track }) => {
      const value = track(query);
      if (Object.is(value, previousQuery_1.value)) return;
      previousQuery_1.value = value;
      onRendered$?.(list.value?.childElementCount ?? -1);
    },
    { strategy: "document-ready" },
  );

  const previousCount = useSignal(() => count.value);
  useTask$(
    ({ track }) => {
      const value = track(count);
      if (Object.is(value, previousCount.value)) return;
      previousCount.value = value;
      doubled.value = value * 2;
    },
    { deferUpdates: false },
  );

  useVisibleTask$(
    async () => {
      status.value = "Ready";
      await nextTick();
      onReady$?.(banner.value?.textContent ?? "");
    },
    { strategy: "document-ready" },
  );

  const addOne = $(async () => {
    count.value += 1;
    await nextTick();
    onShown$?.(total.value?.textContent ?? "");
  });

  return (
    <section class="search-results" aria-label="Search">
      <p ref={banner}>{status.value}</p>
      <label>
        Query
        <input
          name="query"
          onInput$={(_, element) => (query.value = (element as HTMLInputElement).value)}
        />
      </label>
      <ul ref={list} aria-label="Results">
        {results.value.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
      <output ref={total}>{doubled.value}</output>
      <button type="button" onClick$={addOne}>
        Add one
      </button>
    </section>
  );
});

/**
 * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,
 * so they are in the DOM by the next task.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
