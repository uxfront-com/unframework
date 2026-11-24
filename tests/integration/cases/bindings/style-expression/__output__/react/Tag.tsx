import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface TagProps {
  label: string;
  tone?: string;
}

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({ label, className, style, ...attributes }: TagProps & TagAttributes) {
  return (
    <em
      className={cx("tag", className)}
      style={{ color: "rgb(120, 30, 30)", padding: "1px 4px", ...style }}
      {...scopeAttributes(attributes)}
    >
      {label}
    </em>
  );
}
