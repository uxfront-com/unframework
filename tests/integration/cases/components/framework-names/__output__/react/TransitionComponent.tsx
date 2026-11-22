import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface TransitionComponentAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function TransitionComponent({
  className,
  style,
  ...attributes
}: TransitionComponentAttributes) {
  return (
    <p className={cx("note", className)} style={style} {...scopeAttributes(attributes)}>
      Plain child
    </p>
  );
}
