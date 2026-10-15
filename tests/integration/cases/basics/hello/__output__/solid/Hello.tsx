import type { JSX } from "solid-js";

export default function Hello(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <p class={props.class ? `greeting ${props.class}` : "greeting"} style={props.style}>
      Hello, world!
    </p>
  );
}
