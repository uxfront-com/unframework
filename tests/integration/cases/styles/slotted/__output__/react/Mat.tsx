import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";
import "./Mat.uf.tsx.css";

export interface MatSlots {
  children?: ReactNode;
}

export interface MatAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Mat({
  children,
  className,
  style,
  ...attributes
}: MatSlots & MatAttributes) {
  return (
    <div
      className={cx("mat", className)}
      style={style}
      data-uf-09929c4a=""
      {...scopeAttributes(attributes)}
    >
      {children}
    </div>
  );
}
