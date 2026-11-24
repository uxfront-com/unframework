import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface BoxSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export interface BoxAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Box({
  title,
  children,
  className,
  style,
  ...attributes
}: BoxSlots & BoxAttributes) {
  return (
    <div className={cx("box", className)} style={style} {...scopeAttributes(attributes)}>
      <h3>{title ?? "Untitled"}</h3>
      {children ?? <p>No content</p>}
    </div>
  );
}
