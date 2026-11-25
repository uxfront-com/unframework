import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function Badge(
  props: { tone: "info" | "warning" } & Omit<ComponentProps<"span">, "tone" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "tone", "class");

  return (
    <span class={cx("badge", props.tone, props.class)} {...others}>
      {props.tone}
    </span>
  );
}
