import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface ListSlots {
  item$?: QRL<(props: { item: string; index: number }) => JSXOutput>;
}

export default component$<
  { items: string[]; label: string } & ListSlots &
    Omit<PropsOf<"ul">, "items" | "label" | "item$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ items, label, item$, class: className, style, ...attributes }) => {
  return (
    <ul aria-label={label} class={className} style={style} {...attributes}>
      {items.map((item, index) => (
        <li key={item}>{item$?.({ item, index })}</li>
      ))}
    </ul>
  );
});
