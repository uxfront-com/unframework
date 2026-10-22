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
>(({ query: queryProp, onQueryChange$, class: className, style, ...attributes }) => {
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
      {...scopeAttributes(attributes)}
      class={className}
      style={style}
    />
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
