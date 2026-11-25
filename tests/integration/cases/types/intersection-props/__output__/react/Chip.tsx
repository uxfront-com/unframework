import { cx } from "./_unframework/cx";
import type { Sized, Toned } from "./types";
import type { ComponentPropsWithRef } from "react";

type ChipProps = Sized & Toned & { label: string };

export type ChipAttributes = Omit<
  ComponentPropsWithRef<"span">,
  "size" | "tone" | "label" | "children"
>;

export default function Chip({
  size,
  tone = "neutral",
  label,
  className,
  style,
  ...attributes
}: ChipProps & ChipAttributes) {
  return (
    <span className={cx(`chip chip-${size} chip-${tone}`, className)} style={style} {...attributes}>
      {label}
    </span>
  );
}
