import {
  type QRL,
  component$,
  noSerialize,
  useConstant,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface SearchSessionEvents {
  onUnmounted$?: QRL<() => void>;
  onEffectCleaned$?: QRL<(query: string) => void>;
  onWatchCleaned$?: QRL<(query: string) => void>;
  onSearched$?: QRL<(query: string, count: number) => void>;
  onSearchCleaned$?: QRL<(query: string) => void>;
  onSummary$?: QRL<(text: string) => void>;
}

export default component$<SearchSessionEvents>(
  ({
    onUnmounted$,
    onEffectCleaned$,
    onWatchCleaned$,
    onSearched$,
    onSearchCleaned$,
    onSummary$,
  }) => {
    const query = useSignal("");
    const results = useSignal<string[]>([]);

    const previousEffect = useSignal<[typeof query.value]>();
    const effectCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof query.value] = [track(query)];
        const last = previousEffect.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect.value = values;
        for (const callback of effectCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void effectCleanups?.push(callback);
        const value = query.value;
        onCleanup(() => {
          onEffectCleaned$?.(value);
        });
      },
      { strategy: "document-ready" },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of effectCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const previousQuery = useSignal<{ value: typeof query.value }>();
    const queryCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useTask$(
      ({ track }) => {
        const value = track(query);
        const last = previousQuery.value;
        if (last && Object.is(value, last.value)) return;
        previousQuery.value = { value };
        for (const callback of queryCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void queryCleanups?.push(callback);
        onCleanup(() => {
          onWatchCleaned$?.(value);
        });
      },
      { deferUpdates: false },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of queryCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const previousQuery_1 = useSignal(() => query.value);
    useTask$(
      ({ track }) => {
        const value = track(query);
        if (Object.is(value, previousQuery_1.value)) return;
        previousQuery_1.value = value;
        results.value = value === "" ? [] : [value, `${value} docs`];
      },
      { deferUpdates: false },
    );

    const previousQuery_2 = useSignal(() => query.value);
    const queryCleanups_1 = useConstant(() => noSerialize<(() => void)[]>([]));
    useVisibleTask$(
      ({ track }) => {
        const value = track(query);
        if (Object.is(value, previousQuery_2.value)) return;
        previousQuery_2.value = value;
        for (const callback of queryCleanups_1?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void queryCleanups_1?.push(callback);
        onSearched$?.(value, results.value.length);
        onCleanup(() => {
          onSearchCleaned$?.(value);
        });
      },
      { strategy: "document-ready" },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of queryCleanups_1?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    const previousEffect_1 = useSignal<[typeof results.value, typeof query.value]>();
    useVisibleTask$(
      ({ track }) => {
        const values: [typeof results.value, typeof query.value] = [track(results), track(query)];
        const last = previousEffect_1.value;
        if (last && values.every((item, index) => Object.is(item, last[index]))) return;
        previousEffect_1.value = values;
        onSummary$?.(`${results.value.length} results for "${query.value}"`);
      },
      { strategy: "document-ready" },
    );

    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          onUnmounted$?.();
        });
      },
      { strategy: "document-ready" },
    );

    return (
      <section class="search-session" aria-label="Search">
        <label>
          Query
          <input
            name="query"
            onInput$={(_, element) => (query.value = (element as HTMLInputElement).value)}
          />
        </label>
        <ul aria-label="Results">
          {results.value.map((result) => (
            <li key={result}>{result}</li>
          ))}
        </ul>
        <button type="button" onClick$={() => (results.value = [])}>
          Clear results
        </button>
      </section>
    );
  },
);
