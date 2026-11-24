import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function Card(
  props: { heading: string } & Omit<ComponentProps<"section">, "heading" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["heading", "class"]);

  return (
    <section class={props.class ? `card ${props.class}` : "card"} {...others}>
      <h2>{props.heading}</h2>
    </section>
  );
}
