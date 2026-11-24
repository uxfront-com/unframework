import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: { text: string } & Omit<ComponentProps<"aside">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <aside class={props.class ? `panel ${props.class}` : "panel"} data-uf-48dda3f4="" {...others}>
      <p class="text" data-uf-48dda3f4="">
        {props.text}
      </p>
    </aside>
  );
}
