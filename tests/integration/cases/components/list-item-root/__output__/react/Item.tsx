import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ItemAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Item({
  label,
  className,
  style,
  ...attributes
}: { label: string } & ItemAttributes) {
  return (
    <li className={cx("item", className)} style={style} {...scopeAttributes(attributes)}>
      {label}
    </li>
  );
}
