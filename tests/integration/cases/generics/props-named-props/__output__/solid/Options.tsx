import { type Accessor, For, type JSX, createMemo, untrack } from "solid-js";

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
            <li aria-current={option() === props.selected ? "true" : undefined}>
              {String(option())}
            </li>
          )}
        </KeyedFor>
      </ul>
    </>
  );
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
