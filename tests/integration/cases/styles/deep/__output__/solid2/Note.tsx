import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Note(
  props: { text: string } & Omit<ComponentProps<"div">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <div class={props.class ? `note-box ${props.class}` : "note-box"} {...others}>
      <p class="note">{props.text}</p>
    </div>
  );
}
