import { type ComponentProps, For, type JSX, createMemo, splitProps, untrack } from "solid-js";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export default function Table<T extends { id: string; label: string }>(
  props: TableProps<T> &
    Omit<ComponentProps<"table">, "caption" | "rows" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["caption", "rows"]);

  return (
    <table {...others}>
      <caption>{props.caption}</caption>
      <tbody>
        <KeyedFor each={props.rows} by={(row) => row.id}>
          {(row) => (
            <tr>
              <th scope="row">{row.value.id}</th>
              <td>{row.value.label}</td>
            </tr>
          )}
        </KeyedFor>
      </tbody>
    </table>
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
