import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Status(
  props: { state: string } & Omit<ComponentProps<"p">, "state" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["state", "class"]);

  return (
    <p class={props.class ? `status ${props.class}` : "status"} {...others}>
      <Badge text="Build" />
      <Tag text={props.state} />
    </p>
  );
}
