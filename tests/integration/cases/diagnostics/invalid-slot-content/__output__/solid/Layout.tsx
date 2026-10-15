import type { JSX } from "solid-js";

export interface LayoutSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export function Layout(props: LayoutSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <main class={props.class} style={props.style}>
      <h1>{props.title}</h1>
      {props.children}
    </main>
  );
}
