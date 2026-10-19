import { For, type JSX } from "solid-js";

export interface LegendSlots {
  swatch?: (props: { item: string }) => JSX.Element;
  caption?: (props: { item: string }) => JSX.Element;
}

export default function Legend(
  props: { items: string[]; label: string } & LegendSlots & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  return (
    <ul aria-label={props.label} class={props.class} style={props.style}>
      <For each={props.items}>
        {(item) => (
          <li>
            <span>{props.swatch?.({ item })}</span> <span>{props.caption?.({ item })}</span>
          </li>
        )}
      </For>
    </ul>
  );
}
