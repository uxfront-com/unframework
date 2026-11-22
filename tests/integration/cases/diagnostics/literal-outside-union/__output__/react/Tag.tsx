import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export type Tone = "info" | "warning";

export interface TagAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Tag({
  tone,
  className,
  style,
  ...attributes
}: { tone: Tone } & TagAttributes) {
  return (
    <span className={cx("tag", tone, className)} style={style} {...scopeAttributes(attributes)}>
      {tone}
    </span>
  );
}
