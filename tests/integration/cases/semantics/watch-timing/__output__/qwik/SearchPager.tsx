import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  noSerialize,
  useConstant,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface SearchPagerEvents {
  onQueryRun$?: QRL<(value: string, previous: string) => void>;
  onPageRun$?: QRL<(value: number, previous: number) => void>;
  onCleanedUp$?: QRL<(watcher: string) => void>;
}

export default component$<SearchPagerEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onQueryRun$, onPageRun$, onCleanedUp$, class: className, style, ...attributes }) => {
    const query = useSignal("");
    const page = useSignal(1);

    const previousQuery = useSignal(() => query.value);
    const queryCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useTask$(
      ({ track }) => {
        const value = track(query);
        const previous = previousQuery.value;
        if (Object.is(value, previous)) return;
        previousQuery.value = value;
        for (const callback of queryCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void queryCleanups?.push(callback);
        onQueryRun$?.(value, previous);
        onCleanup(() => {
          onCleanedUp$?.("query");
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

    const previousPage = useSignal(() => page.value);
    useTask$(
      ({ track }) => {
        const value = track(page);
        const previous = previousPage.value;
        if (Object.is(value, previous)) return;
        previousPage.value = value;
        onPageRun$?.(value, previous);
      },
      { deferUpdates: false },
    );

    const search = $((term: string) => {
      query.value = term;
      query.value = query.value.toLowerCase();
      page.value = 1;
    });

    const nextPage = $(() => {
      page.value += 1;
    });

    const skipTwoPages = $(() => {
      page.value += 1;
      page.value += 1;
    });

    return (
      <section
        class={["search-pager", className]}
        aria-label="Search"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">
          {query.value === "" ? "All results" : `Results for ${query.value}`}, page {page.value}
        </p>
        <button type="button" onClick$={() => search("Boots")}>
          Search boots
        </button>
        <button type="button" onClick$={() => search("Sandals")}>
          Search sandals
        </button>
        <button type="button" onClick$={nextPage}>
          Next page
        </button>
        <button type="button" onClick$={skipTwoPages}>
          Skip two pages
        </button>
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
