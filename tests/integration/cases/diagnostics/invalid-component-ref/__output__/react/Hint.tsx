import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface HintAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Hint({ text, className, style, ...attributes }: { text: string } & HintAttributes) {
  return (
    <small className={cx("hint", className)} style={style} {...scopeAttributes(attributes)}>
      {text}
    </small>
  );
}
