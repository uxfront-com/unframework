// Generic interfaces and aliases, instantiated; and the types only a type-checker evaluates.

import type { Boxed, ListProps, Pair, Tree } from "./types.ts";

interface Option {
  id: string;
  name: string;
}

type Kind<T> = T extends string ? "text" : "other";

type Flags = { [K in "bold" | "italic"]?: string };

export function Strings(props: ListProps<string>) {
  return props;
}

export function Objects(props: ListProps<Option>) {
  return props;
}

export function List<T>(props: ListProps<T>) {
  return props;
}

export function Defaulted(props: Pair<number>) {
  return props;
}

export function Recursive(props: Tree<string>) {
  return props;
}

export function Based(props: Boxed<number>) {
  return props;
}

export function Picked(props: Pick<ListProps<number>, "items">) {
  return props;
}

export function Conditional(props: { kind: Kind<string> }) {
  return props;
}

export function Mapped(props: Flags) {
  return props;
}
