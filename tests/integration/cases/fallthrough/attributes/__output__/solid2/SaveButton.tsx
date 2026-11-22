import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function SaveButton(
  props: { title: string } & Omit<ComponentProps<"button">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "class");

  return (
    <button type="button" class={props.class ? `button ${props.class}` : "button"} {...others}>
      {props.title}
    </button>
  );
}
