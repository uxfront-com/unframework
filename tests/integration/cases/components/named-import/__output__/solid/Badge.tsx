import type { JSX } from "solid-js";

export function Badge(props: { text: string } & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <span class={props.class ? `badge ${props.class}` : "badge"} style={props.style}>
      {props.text}
    </span>
  );
}
