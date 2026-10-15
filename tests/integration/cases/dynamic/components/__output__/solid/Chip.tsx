import type { JSX } from "solid-js";

export default function Chip(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span class={props.class ? `chip ${props.class}` : "chip"} style={props.style}>
      {props.label}
    </span>
  );
}
