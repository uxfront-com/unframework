import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Status(
  props: { state: string } & Omit<ComponentProps<"p">, "state" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "state", "class");

  return (
    <p class={props.class ? `status ${props.class}` : "status"} {...others}>
      <Badge text="Build" />
      <Tag text={props.state} />
    </p>
  );
}
