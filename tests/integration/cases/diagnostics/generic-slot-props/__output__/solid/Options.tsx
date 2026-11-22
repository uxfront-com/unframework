import { type ComponentProps, For, type JSX, createMemo, splitProps, untrack } from "solid-js";

export interface OptionsSlots<T extends { value: string }> {
  option?: (props: { option: T }) => JSX.Element;
}

export default function Options<T extends { value: string }>(
  props: { options: T[] } & OptionsSlots<T> &
    Omit<ComponentProps<"ul">, "options" | "option" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["options", "option"]);

  return (
    <ul {...others}>
      <KeyedFor each={props.options} by={(option) => option.value}>
        {(option) => <li>{props.option?.({ option: option.value })}</li>}
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
