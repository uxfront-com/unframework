import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface SearchFieldModels {
  query?: string;
  onQueryChange?: (value: string) => void;
}

export function SearchField(
  props: SearchFieldModels &
    Omit<ComponentProps<"input">, "query" | "class" | "style" | "onInput"> & {
      class?: string;
      style?: JSX.CSSProperties;
      onInput?: Extract<ComponentProps<"input">["onInput"], (event: never) => void>;
    },
) {
  const others = omit(props, "query", "onQueryChange", "onInput");

  const [localQuery, setLocalQuery] = createState<string>();
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
