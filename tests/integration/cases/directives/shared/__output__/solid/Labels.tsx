import Badge from "./Badge";
import Tag from "./Tag";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Labels(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  return (
    <section
      class={props.class ? `labels ${props.class}` : "labels"}
      aria-label="Labels"
      {...others}
    >
      <Badge label="New" />
      <Tag name="docs" />
    </section>
  );
}
