import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Base(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <button type="button" class={props.class ? `base ${props.class}` : "base"} {...others}>
      {props.text}
    </button>
  );
}
