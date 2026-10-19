import { type JSX, createSignal } from "solid-js";

export interface SearchFieldModels {
  query?: string;
  onQueryChange?: (value: string) => void;
}

export function SearchField(
  props: SearchFieldModels & { class?: string; style?: JSX.CSSProperties },
) {
  const [localQuery, setLocalQuery] = createSignal<string>();
  const query = () => (props.query === undefined ? localQuery() : props.query);

  function setQuery(next: string) {
    setLocalQuery(next);
    props.onQueryChange?.(next);
  }

  return (
    <input
      type="search"
      aria-label="Search"
      value={query() ?? ""}
      onInput={(event) => setQuery(event.currentTarget.value)}
      class={props.class}
      style={props.style}
    />
  );
}
