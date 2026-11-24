import Box from "./Box";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface FrameSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Frame(
  props: { label: string } & FrameSlots &
    Omit<ComponentProps<"section">, "label" | "title" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "title", "children", "class");

  return (
    <section
      class={props.class ? `frame ${props.class}` : "frame"}
      aria-label={props.label}
      {...others}
    >
      <Box children={props.children} title={props.title} />
    </section>
  );
}
