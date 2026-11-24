import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PanelSlots {
  children?: JSX.Element;
}

export default function Panel(
  props: { title: string } & PanelSlots &
    Omit<ComponentProps<"section">, "title" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "children", "class");

  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label={props.title}
      {...others}
    >
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}
