import type { JSX } from "solid-js";

export interface PanelSlots {
  title?: JSX.Element;
}

export default function Panel(props: PanelSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div class={props.class ? `panel ${props.class}` : "panel"} style={props.style}>
      <h4>{props.title ?? "Untitled"}</h4>
    </div>
  );
}
