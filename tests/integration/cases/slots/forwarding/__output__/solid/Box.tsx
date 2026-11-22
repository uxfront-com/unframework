import { type ComponentProps, type JSX, children, splitProps } from "solid-js";

export interface BoxSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Box(
  props: BoxSlots &
    Omit<ComponentProps<"div">, "title" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "children", "class"]);

  const content = children(() => props.children);
  return (
    <div class={props.class ? `box ${props.class}` : "box"} {...others}>
      <h3>{props.title ?? "Untitled"}</h3>
      {content() ?? <p>No content</p>}
    </div>
  );
}
