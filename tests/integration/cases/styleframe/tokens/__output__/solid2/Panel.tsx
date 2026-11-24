import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "virtual:styleframe.css";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: { text: string } & Omit<ComponentProps<"section">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <section class={props.class ? `panel ${props.class}` : "panel"} data-uf-b6be1fd3="" {...others}>
      <p class="body" data-uf-b6be1fd3="">
        {props.text}
      </p>
    </section>
  );
}
