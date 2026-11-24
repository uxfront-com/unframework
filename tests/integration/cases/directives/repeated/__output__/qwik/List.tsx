import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface ListSlots {
  item$?: QRL<(props: { item: string }) => JSXOutput>;
}

export default component$<
  { items: string[] } & ListSlots &
    Omit<PropsOf<"ol">, "items" | "item$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ items, item$, class: className, style, ...attributes }) => {
  return (
    <ol class={className} style={style} {...attributes}>
      {items.map((item) => (
        <li key={item}>{item$?.({ item })}</li>
      ))}
    </ol>
  );
});
