import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface EachSlotSlots {
  row$?: QRL<(props: { item: string }) => JSXOutput>;
}

export default component$<
  { items: string[] } & EachSlotSlots &
    Omit<PropsOf<"span">, "items" | "row$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ items, row$, class: className, style, ...attributes }) => {
  return (
    <span class={["each-slot", className]} style={style} {...attributes}>
      {items.map((item) => (
        <span key={item} class="each-row">
          {row$?.({ item })}
        </span>
      ))}
    </span>
  );
});
