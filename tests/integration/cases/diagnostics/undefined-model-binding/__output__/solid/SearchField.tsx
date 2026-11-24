import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface SearchFieldModels {
  query?: string;
  onQueryChange?: (value: string) => void;
}

export function SearchField(
  props: SearchFieldModels &
    Omit<ComponentProps<"input">, "query" | "style" | "onInput"> & {
      style?: JSX.CSSProperties;
      onInput?: Extract<ComponentProps<"input">["onInput"], (event: never) => void>;
    },
) {
  const [, others] = splitProps(props, ["query", "onQueryChange", "onInput"]);

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
      onInput={(event) => {
        setQuery(event.currentTarget.value);
        props.onInput?.(event);
      }}
      {...others}
    />
  );
}
