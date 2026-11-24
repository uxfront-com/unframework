import {
  type ComponentProps,
  For,
  type JSX,
  createMemo,
  createSignal,
  splitProps,
  untrack,
} from "solid-js";

export interface RowsSlots {
  row?: JSX.Element;
}

export default function Rows(
  props: RowsSlots & Omit<ComponentProps<"div">, "row" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["row", "class"]);

  const [items, setItems] = createSignal([1, 2]);

  return (
    <div class={props.class ? `rows ${props.class}` : "rows"} {...others}>
      <ul>
        <KeyedFor each={items()} by={(item) => item}>
          {() => <li>{props.row}</li>}
        </KeyedFor>
      </ul>
      <button type="button" onClick={() => setItems([...items(), items().length + 1])}>
        Add row
      </button>
      <button type="button" onClick={() => setItems(items().slice(0, -1))}>
        Remove row
      </button>
    </div>
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
