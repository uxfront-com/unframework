import type { JSX } from "solid-js";

export default function Base(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <button type="button" class={props.class ? `base ${props.class}` : "base"} style={props.style}>
      {props.text}
    </button>
  );
}
