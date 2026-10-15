import { For, type JSX } from "solid-js";

export interface ListSlots {
  item?: (props: { item: string; index: number }) => JSX.Element;
}

export default function List(
  props: { items: string[]; label: string } & ListSlots & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  return (
    <ul aria-label={props.label} class={props.class} style={props.style}>
      <For each={props.items}>
        {(item, index) => <li>{props.item?.({ item, index: index() })}</li>}
      </For>
    </ul>
  );
}
