import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface CardSlots {
  title?: JSX.Element;
}

export default function Card(
  props: CardSlots & Omit<ComponentProps<"div">, "title" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "class"]);

  return (
    <div class={props.class ? `card ${props.class}` : "card"} {...others}>
      <h3>{props.title ?? "Untitled"}</h3>
    </div>
  );
}
