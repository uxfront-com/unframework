import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface ListSlots {
  item$?: QRL<(props: { item: string; index: number }) => JSXOutput>;
}

export default component$<
  { items: string[]; label: string } & ListSlots & { class?: ClassList; style?: CSSProperties }
>(({ items, label, item$, class: className, style }) => {
  return (
    <ul aria-label={label} class={className} style={style}>
      {items.map((item, index) => (
        <li key={item}>{item$?.({ item, index })}</li>
      ))}
    </ul>
  );
});
