import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
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
  SearchFieldModels &
    Omit<PropsOf<"input">, "query" | "onQueryChange$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ query: queryProp, onQueryChange$, class: className, style, onInput$, ...attributes }) => {
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
      onInput$={[$((_, element) => setQuery(element.value)), onInput$]}
      class={className}
      style={style}
      {...attributes}
    />
  );
});
