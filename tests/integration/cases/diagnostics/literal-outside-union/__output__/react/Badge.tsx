import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Badge({
  tone,
  className,
  style,
  ...attributes
}: { tone: "info" | "warning" } & BadgeAttributes) {
  return (
    <span className={cx("badge", tone, className)} style={style} {...scopeAttributes(attributes)}>
      {tone}
    </span>
  );
}
