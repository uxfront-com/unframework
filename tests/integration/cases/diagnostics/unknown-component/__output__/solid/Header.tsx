import type { JSX } from "solid-js";

export function Header(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <header class={props.class ? `header ${props.class}` : "header"} style={props.style}>
      Site
    </header>
  );
}
