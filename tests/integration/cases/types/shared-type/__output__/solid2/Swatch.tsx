import { cx } from "./_unframework/cx";
import type { Tone } from "./types";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Swatch(
  props: { tone: Tone } & Omit<ComponentProps<"span">, "tone" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "tone", "class");

  return (
    <span class={cx(`swatch swatch-${props.tone}`, props.class)} {...others}>
      {props.tone}
    </span>
  );
}
