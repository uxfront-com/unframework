import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import { chip } from "virtual:fixture-engine";
import "virtual:fixture-engine.css";

export interface ChipAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Chip({
  label,
  tone,
  className,
  style,
  ...attributes
}: { label: string; tone?: "plain" | "accent" } & ChipAttributes) {
  return (
    <span className={cx(chip(tone), className)} style={style} {...scopeAttributes(attributes)}>
      {label}
    </span>
  );
}
