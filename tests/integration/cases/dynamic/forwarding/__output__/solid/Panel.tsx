import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface PanelSlots {
  title?: JSX.Element;
}

export default function Panel(
  props: PanelSlots &
    Omit<ComponentProps<"div">, "title" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "class"]);

  return (
    <div class={props.class ? `panel ${props.class}` : "panel"} {...others}>
      <h4>{props.title ?? "Untitled"}</h4>
    </div>
  );
}
