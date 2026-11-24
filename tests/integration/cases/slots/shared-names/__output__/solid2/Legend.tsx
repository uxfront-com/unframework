import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, omit, untrack } from "solid-js";

export interface LegendSlots {
  swatch?: (props: { item: string }) => JSX.Element;
  caption?: (props: { item: string }) => JSX.Element;
}

export default function Legend(
  props: { items: string[]; label: string } & LegendSlots &
    Omit<ComponentProps<"ul">, "items" | "label" | "swatch" | "caption" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "items", "label", "swatch", "caption");

  return (
    <ul aria-label={props.label} {...others}>
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => (
          <li>
            <span>{props.swatch?.({ item: item.value })}</span>{" "}
            <span>{props.caption?.({ item: item.value })}</span>
          </li>
        )}
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
