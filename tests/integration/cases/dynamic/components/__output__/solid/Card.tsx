import type { JSX } from "solid-js";

export default function Card(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class ? `card ${props.class}` : "card"} style={props.style}>
      <strong>{props.label}</strong>
    </div>
  );
}
