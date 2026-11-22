import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface CardSlots {
  title?: JSX.Element;
}

export default function Card(
  props: CardSlots &
    Omit<ComponentProps<"div">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "class");

  return (
    <div class={props.class ? `card ${props.class}` : "card"} {...others}>
      <h3>{props.title ?? "Untitled"}</h3>
    </div>
  );
}
