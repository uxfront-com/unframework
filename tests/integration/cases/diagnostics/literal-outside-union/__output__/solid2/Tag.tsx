import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export type Tone = "info" | "warning";

export default function Tag(
  props: { tone: Tone } & Omit<ComponentProps<"span">, "tone" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "tone", "class");

  return (
    <span class={cx("tag", props.tone, props.class)} {...others}>
      {props.tone}
    </span>
  );
}
