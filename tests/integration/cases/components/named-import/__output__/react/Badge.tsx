import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Badge({
  text,
  className,
  style,
  ...attributes
}: { text: string } & BadgeAttributes) {
  return (
    <span className={cx("badge", className)} style={style} {...scopeAttributes(attributes)}>
      {text}
    </span>
  );
}
