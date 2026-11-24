import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({
  label,
  className,
  style,
  ...attributes
}: { label: string } & TagAttributes) {
  return (
    <span
      className={cx("tag", className)}
      style={{ padding: "2px 6px", color: "rgb(30, 30, 30)", ...style }}
      {...scopeAttributes(attributes)}
    >
      {label}
    </span>
  );
}
