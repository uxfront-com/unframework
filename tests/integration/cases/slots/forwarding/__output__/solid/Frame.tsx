import Box from "./Box";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface FrameSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Frame(
  props: { label: string } & FrameSlots &
    Omit<ComponentProps<"section">, "label" | "title" | "children" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "title", "children", "class"]);

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
