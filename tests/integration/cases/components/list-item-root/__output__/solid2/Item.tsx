import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Item(
  props: { label: string } & Omit<ComponentProps<"li">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

  return (
    <li class={props.class ? `item ${props.class}` : "item"} {...others}>
      {props.label}
    </li>
  );
}
