import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function Pill(
  props: { text: string } & Omit<ComponentProps<"span">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <span class={props.class ? `pill ${props.class}` : "pill"} {...others}>
      {props.text}
    </span>
  );
}
