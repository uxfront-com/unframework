import { type Accessor, For, type JSX, createMemo, untrack } from "solid-js";

export interface TableProps<T extends { id: string; label: string }> {
  caption: string;
  rows: T[];
}

export default function Table<T extends { id: string; label: string }>(
  props: TableProps<T> & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <table class={props.class} style={props.style} {...scopeAttributes(props)}>
      <caption>{props.caption}</caption>
      <tbody>
        <KeyedFor each={props.rows} by={(row) => row.id}>
          {(row) => (
            <tr>
              <th scope="row">{row().id}</th>
              <td>{row().label}</td>
            </tr>
          )}
        </KeyedFor>
      </tbody>
    </table>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
