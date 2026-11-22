import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "virtual:styleframe.css";

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
      className={cx(
        "_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]",
        className,
      )}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {label}
    </span>
  );
}
