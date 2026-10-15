import type { JSX } from "solid-js";

export interface PanelSlots {
  children?: JSX.Element;
}

export default function Panel(
  props: { title: string } & PanelSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label={props.title}
      style={props.style}
    >
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}
