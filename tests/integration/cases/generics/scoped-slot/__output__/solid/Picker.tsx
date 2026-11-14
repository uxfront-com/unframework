import { type Accessor, For, type JSX, createMemo, untrack } from "solid-js";

export interface PickerProps<T> {
  items: T[];
}

export interface PickerSlots<T> {
  item?: (props: { item: T }) => JSX.Element;
}

export default function Picker<T>(
  props: PickerProps<T> & PickerSlots<T> & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul class={props.class} style={props.style} {...scopeAttributes(props)}>
      <KeyedFor each={props.items} by={(item, index) => index}>
        {(item) => <li>{props.item?.({ item: item() })}</li>}
      </KeyedFor>
    </ul>
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
