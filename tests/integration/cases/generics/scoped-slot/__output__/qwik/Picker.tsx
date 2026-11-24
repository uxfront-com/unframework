import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface PickerProps<T> {
  items: T[];
}

export interface PickerSlots<T> {
  item$?: QRL<(props: { item: T }) => JSXOutput>;
}

export default component$(
  <T,>({
    items,
    item$,
    class: className,
    style,
    ...attributes
  }: PickerProps<T> &
    PickerSlots<T> &
    Omit<PropsOf<"ul">, "items" | "item$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }) => {
    return (
      <ul class={className} style={style} {...attributes}>
        {items.map((item, index) => (
          <li key={index}>{item$?.({ item })}</li>
        ))}
      </ul>
    );
  },
);
