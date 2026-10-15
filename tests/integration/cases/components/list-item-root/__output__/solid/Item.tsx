import type { JSX } from "solid-js";

export default function Item(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <li class={props.class ? `item ${props.class}` : "item"} style={props.style}>
      {props.label}
    </li>
  );
}
