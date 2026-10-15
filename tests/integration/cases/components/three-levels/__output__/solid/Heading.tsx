import type { JSX } from "solid-js";

export default function Heading(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <h3 class={props.class ? `heading ${props.class}` : "heading"} style={props.style}>
      {props.text}
    </h3>
  );
}
