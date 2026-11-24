import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function Hint(
  props: { text: string } & Omit<ComponentProps<"small">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <small class={props.class ? `hint ${props.class}` : "hint"} {...others}>
      {props.text}
    </small>
  );
}
