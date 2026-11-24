import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Card(
  props: { label: string } & Omit<ComponentProps<"div">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

  return (
    <div class={props.class ? `card ${props.class}` : "card"} {...others}>
      <strong>{props.label}</strong>
    </div>
  );
}
