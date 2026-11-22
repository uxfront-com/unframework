import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, omit, untrack } from "solid-js";

export interface NamesSlots {
  children?: (props: { item: string }) => JSX.Element;
}

export default function Names(
  props: { names: string[] } & NamesSlots &
    Omit<ComponentProps<"ul">, "names" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "names", "children");

  return (
    <ul aria-label="Names" {...others}>
      <KeyedFor each={props.names} by={(item) => item}>
        {(item) => <li>{props.children?.({ item: item.value })}</li>}
      </KeyedFor>
    </ul>
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
