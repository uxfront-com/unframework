import { type ComponentProps, For, type JSX, createMemo, splitProps, untrack } from "solid-js";

export interface Row {
  id: number;
  label: string;
}

export default function KeyedRows(
  props: { rows: Row[] } & Omit<ComponentProps<"ul">, "rows" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["rows"]);

  return (
    <ul {...others}>
      <KeyedFor each={props.rows} by={(row) => row.id}>
        {(row) => <li data-index={row.index}>{row.value.label}</li>}
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
