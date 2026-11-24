import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

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

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
