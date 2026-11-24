import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ChipAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Chip({
  label,
  className,
  style,
  ...attributes
}: { label: string } & ChipAttributes) {
  return (
    <span className={cx("chip", className)} style={style} {...scopeAttributes(attributes)}>
      {label}
    </span>
  );
}
