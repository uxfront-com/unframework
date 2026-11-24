import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Button(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <button type="button" class={props.class ? `button ${props.class}` : "button"} {...others}>
      <span class="icon" aria-hidden="true">
        +
      </span>
      {props.text}
    </button>
  );
}
