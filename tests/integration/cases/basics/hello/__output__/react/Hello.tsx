import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface HelloAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Hello({ className, style, ...attributes }: HelloAttributes) {
  return (
    <p className={cx("greeting", className)} style={style} {...scopeAttributes(attributes)}>
      Hello, world!
    </p>
  );
}
