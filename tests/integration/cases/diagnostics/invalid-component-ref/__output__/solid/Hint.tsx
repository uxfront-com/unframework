import type { JSX } from "solid-js";

export function Hint(props: { text: string } & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <small class={props.class ? `hint ${props.class}` : "hint"} style={props.style}>
      {props.text}
    </small>
  );
}
