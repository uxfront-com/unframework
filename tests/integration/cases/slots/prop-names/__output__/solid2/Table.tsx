import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, omit, untrack } from "solid-js";

export interface Person {
  id: string;
  name: string;
}

export interface TableSlots {
  row?: (props: { name: string; "data-id": string; index: number }) => JSX.Element;
}

export default function Table(
  props: { people: Person[] } & TableSlots &
    Omit<ComponentProps<"ol">, "people" | "row" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "people", "row");

  return (
    <ol aria-label="People" {...others}>
      <KeyedFor each={props.people} by={(person) => person.id}>
        {(person) => (
          <li>
            {props.row?.({
              name: person.value.name,
              "data-id": person.value.id,
              index: person.index,
            })}
          </li>
        )}
      </KeyedFor>
    </ol>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
