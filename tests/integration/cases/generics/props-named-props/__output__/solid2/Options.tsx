import type { JSX } from "@solidjs/web";
import { For, createMemo, untrack } from "solid-js";

interface Props<T> {
  heading: string;
  options: T[];
  selected?: T;
}

export default function Options<T>(props: Props<T>) {
  return (
    <>
      <h2>{props.heading}</h2>
      <ul aria-label={props.heading}>
        <KeyedFor each={props.options} by={(option, index) => index}>
          {(option) => (
            <li
              aria-current={enumeratedValue(option.value === props.selected ? "true" : undefined)}
            >
              {String(option.value)}
            </li>
          )}
        </KeyedFor>
      </ul>
    </>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
