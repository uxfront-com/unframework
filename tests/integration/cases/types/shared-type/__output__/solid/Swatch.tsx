import { cx } from "./_unframework/cx";
import type { Tone } from "./types";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Swatch(
  props: { tone: Tone } & Omit<ComponentProps<"span">, "tone" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["tone", "class"]);

  return (
    <span class={cx(`swatch swatch-${props.tone}`, props.class)} {...others}>
      {props.tone}
    </span>
  );
}
