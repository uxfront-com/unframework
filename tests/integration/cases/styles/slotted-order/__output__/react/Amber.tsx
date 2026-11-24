import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";
import "./Amber.uf.tsx.css";

export interface AmberSlots {
  children?: ReactNode;
}

export interface AmberAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Amber({
  children,
  className,
  style,
  ...attributes
}: AmberSlots & AmberAttributes) {
  return (
    <div
      className={cx("amber", className)}
      style={style}
      data-uf-c97301b3=""
      {...scopeAttributes(attributes)}
    >
      {children}
    </div>
  );
}
