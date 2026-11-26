import { cx } from "./_unframework/cx";
import type { Sized, Toned } from "./types";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

type ChipProps = Sized & Toned & { label: string };

export default function Chip(
  rawProps: ChipProps &
    Omit<ComponentProps<"span">, "size" | "tone" | "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const props = mergeProps({ tone: "neutral" } satisfies Partial<ChipProps>, rawProps);
  const [, others] = splitProps(props, ["size", "tone", "label", "class"]);

  return (
    <span class={cx(`chip chip-${props.size} chip-${props.tone}`, props.class)} {...others}>
      {props.label}
    </span>
  );
}
