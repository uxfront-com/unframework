import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { BadgeProps } from "./types";
import type { CSSProperties } from "react";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  label,
  tone = "info",
  className,
  style,
  ...attributes
}: BadgeProps & BadgeAttributes) {
  return (
    <span
      className={cx(`badge badge-${tone}`, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {label}
    </span>
  );
}
