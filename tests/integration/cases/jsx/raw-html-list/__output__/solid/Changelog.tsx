import { type ComponentProps, For, type JSX, createMemo, splitProps, untrack } from "solid-js";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

export default function Changelog(
  props: ChangelogProps &
    Omit<ComponentProps<"ul">, "entries" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["entries", "class"]);

  return (
    <ul class={props.class ? `changelog ${props.class}` : "changelog"} {...others}>
      <KeyedFor each={props.entries} by={(entry) => entry.id}>
        {(entry) => <li innerHTML={entry.value.html} />}
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
