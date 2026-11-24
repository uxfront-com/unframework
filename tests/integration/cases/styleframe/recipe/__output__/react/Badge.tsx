import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  label,
  className,
  style,
  ...attributes
}: { label: string } & BadgeAttributes) {
  return (
    <span className={cx(badge(), className)} style={style} {...scopeAttributes(attributes)}>
      {label}
    </span>
  );
}
