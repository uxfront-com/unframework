import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export type Tone = "info" | "warning";

export default function Tag(
  props: { tone: Tone } & Omit<ComponentProps<"span">, "tone" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["tone", "class"]);

  return (
    <span class={cx("tag", props.tone, props.class)} {...others}>
      {props.tone}
    </span>
  );
}
