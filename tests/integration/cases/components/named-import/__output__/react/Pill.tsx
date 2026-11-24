import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface PillAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Pill({ text, className, style, ...attributes }: { text: string } & PillAttributes) {
  return (
    <span className={cx("pill", className)} style={style} {...scopeAttributes(attributes)}>
      {text}
    </span>
  );
}
