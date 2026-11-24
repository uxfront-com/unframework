import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  label,
  className,
  style,
  ...attributes
}: { label: string } & CardAttributes) {
  return (
    <div className={cx("card", className)} style={style} {...scopeAttributes(attributes)}>
      <strong>{label}</strong>
    </div>
  );
}
