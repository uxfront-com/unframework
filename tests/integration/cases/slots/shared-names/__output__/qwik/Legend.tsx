import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface LegendSlots {
  swatch$?: QRL<(props: { item: string }) => JSXOutput>;
  caption$?: QRL<(props: { item: string }) => JSXOutput>;
}

export default component$<
  { items: string[]; label: string } & LegendSlots & { class?: ClassList; style?: CSSProperties }
>(({ items, label, swatch$, caption$, class: className, style }) => {
  return (
    <ul aria-label={label} class={className} style={style}>
      {items.map((item) => (
        <li key={item}>
          <span>{swatch$?.({ item })}</span> <span>{caption$?.({ item })}</span>
        </li>
      ))}
    </ul>
  );
});
