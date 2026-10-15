import type { JSX } from "solid-js";

export function Card(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <p class={props.class} style={props.style}>
      Card
    </p>
  );
}
