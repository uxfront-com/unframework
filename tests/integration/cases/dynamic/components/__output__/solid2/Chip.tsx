import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Chip(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

  return (
    <span class={props.class ? `chip ${props.class}` : "chip"} {...others}>
      {props.label}
    </span>
  );
}
