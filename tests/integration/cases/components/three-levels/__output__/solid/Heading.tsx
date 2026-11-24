import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Heading(
  props: { text: string } & Omit<ComponentProps<"h3">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <h3 class={props.class ? `heading ${props.class}` : "heading"} {...others}>
      {props.text}
    </h3>
  );
}
