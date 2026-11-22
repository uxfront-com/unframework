import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface CardSlots {
  title?: ReactNode;
}

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  title,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  return (
    <div className={cx("card", className)} style={style} {...scopeAttributes(attributes)}>
      <h3>{title ?? "Untitled"}</h3>
    </div>
  );
}
