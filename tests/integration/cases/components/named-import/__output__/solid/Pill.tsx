import type { JSX } from "solid-js";

export function Pill(props: { text: string } & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <span class={props.class ? `pill ${props.class}` : "pill"} style={props.style}>
      {props.text}
    </span>
  );
}
