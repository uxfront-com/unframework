import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PanelSlots {
  title?: JSX.Element;
}

export default function Panel(
  props: PanelSlots &
    Omit<ComponentProps<"div">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "class");

  return (
    <div class={props.class ? `panel ${props.class}` : "panel"} {...others}>
      <h4>{props.title ?? "Untitled"}</h4>
    </div>
  );
}
