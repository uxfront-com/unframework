import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface BaseAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Base({
  text,
  className,
  style,
  ...attributes
}: { text: string } & BaseAttributes) {
  return (
    <button
      type="button"
      className={cx("base", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {text}
    </button>
  );
}
