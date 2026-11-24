import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function Card(
  props: { heading: string } & Omit<ComponentProps<"section">, "heading" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "heading", "class");

  return (
    <section class={props.class ? `card ${props.class}` : "card"} {...others}>
      <h2>{props.heading}</h2>
    </section>
  );
}
