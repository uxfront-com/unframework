import Badge from "./Badge";
import Tag from "./Tag";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Labels(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

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
