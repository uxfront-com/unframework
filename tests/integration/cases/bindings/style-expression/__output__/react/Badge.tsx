import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { styleObject } from "./_unframework/styleObject";
import type { CSSProperties } from "react";

export interface BadgeProps {
  label: string;
  tone?: string;
}

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  label,
  tone,
  className,
  style,
  ...attributes
}: BadgeProps & BadgeAttributes) {
  return (
    <span
      className={cx("badge", className)}
      style={{ ...styleObject(tone), ...style }}
      {...scopeAttributes(attributes)}
    >
      {label}
    </span>
  );
}
