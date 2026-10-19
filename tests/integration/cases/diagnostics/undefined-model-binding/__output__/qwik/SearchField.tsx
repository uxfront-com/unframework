import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useComputed$,
  useSignal,
} from "@qwik.dev/core";

export interface SearchFieldModels {
  query?: string;
  onQueryChange$?: QRL<(query: string) => void>;
}

export const SearchField = component$<
  SearchFieldModels & { class?: ClassList; style?: CSSProperties }
>(({ query: queryProp, onQueryChange$, class: className, style }) => {
  const queryLocal = useSignal<string>();
  const query = useComputed$(() => (queryProp === undefined ? queryLocal.value : queryProp));

  const setQuery = $(async (next: string) => {
    if (queryProp === undefined) queryLocal.value = next;
    await onQueryChange$?.(next);
  });

  const currentQuery = query.value;

  return (
    <input
      type="search"
      aria-label="Search"
      value={currentQuery}
      onInput$={(_, element) => setQuery(element.value)}
      class={className}
      style={style}
    />
  );
});
