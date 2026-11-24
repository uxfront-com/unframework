import { CardIcon } from "./CardIcon";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Card(
  props: { title: string } & Omit<ComponentProps<"div">, "title" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["title", "class"]);

  return (
    <div class={props.class ? `card ${props.class}` : "card"} {...others}>
      <CardIcon symbol="+" />
      <h3>{props.title}</h3>
      <CardIcon symbol="-" />
    </div>
  );
}
