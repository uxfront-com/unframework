import type { JSX } from "solid-js";

export default function TransitionComponent(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <p class={props.class ? `note ${props.class}` : "note"} style={props.style}>
      Plain child
    </p>
  );
}
