import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { Sized, Toned } from "./types";
import type { CSSProperties } from "react";

type ChipProps = Sized & Toned & { label: string };

export interface ChipAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Chip({
  size,
  tone = "neutral",
  label,
  className,
  style,
  ...attributes
}: ChipProps & ChipAttributes) {
  return (
    <span
      className={cx(`chip chip-${size} chip-${tone}`, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {label}
    </span>
  );
}
