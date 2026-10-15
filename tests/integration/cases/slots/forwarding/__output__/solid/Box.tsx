import { type JSX, children } from "solid-js";

export interface BoxSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Box(props: BoxSlots & { class?: string; style?: JSX.CSSProperties }) {
  const content = children(() => props.children);
  return (
    <div class={props.class ? `box ${props.class}` : "box"} style={props.style}>
      <h3>{props.title ?? "Untitled"}</h3>
      {content() ?? <p>No content</p>}
    </div>
  );
}
