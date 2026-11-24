import { CardIcon } from "./CardIcon";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Card(
  props: { title: string } & Omit<ComponentProps<"div">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "class");

  return (
    <div class={props.class ? `card ${props.class}` : "card"} {...others}>
      <CardIcon symbol="+" />
      <h3>{props.title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
}
