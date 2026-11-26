import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import { chip } from "virtual:fixture-engine";
import "virtual:fixture-engine.css";

export type ChipAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "tone" | "children">;

export default function Chip({
  label,
  tone,
  className,
  style,
  ...attributes
}: { label: string; tone?: "plain" | "accent" } & ChipAttributes) {
  return (
    <span className={cx(chip(tone), className)} style={style} {...attributes}>
      {label}
    </span>
  );
}
