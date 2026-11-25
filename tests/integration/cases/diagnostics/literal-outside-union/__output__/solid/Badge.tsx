import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function Badge(
  props: { tone: "info" | "warning" } & Omit<ComponentProps<"span">, "tone" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["tone", "class"]);

  return (
    <span class={cx("badge", props.tone, props.class)} {...others}>
      {props.tone}
    </span>
  );
}
