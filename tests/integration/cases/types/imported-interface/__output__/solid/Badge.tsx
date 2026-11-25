import { cx } from "./_unframework/cx";
import type { BadgeProps } from "./types";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export default function Badge(
  rawProps: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "tone" | "style"> & { style?: JSX.CSSProperties },
) {
  const props = mergeProps({ tone: "info" } satisfies Partial<BadgeProps>, rawProps);
  const [, others] = splitProps(props, ["label", "tone", "class"]);

  return (
    <span class={cx(`badge badge-${props.tone}`, props.class)} {...others}>
      {props.label}
    </span>
  );
}
