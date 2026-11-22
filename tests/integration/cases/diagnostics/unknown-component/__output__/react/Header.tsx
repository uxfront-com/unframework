import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface HeaderAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Header({ className, style, ...attributes }: HeaderAttributes) {
  return (
    <header className={cx("header", className)} style={style} {...scopeAttributes(attributes)}>
      Site
    </header>
  );
}
