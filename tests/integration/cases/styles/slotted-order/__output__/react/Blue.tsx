import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";
import "./Blue.uf.tsx.css";

export interface BlueSlots {
  children?: ReactNode;
}

export interface BlueAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Blue({
  children,
  className,
  style,
  ...attributes
}: BlueSlots & BlueAttributes) {
  return (
    <div
      className={cx("blue", className)}
      style={style}
      data-uf-721c504a=""
      {...scopeAttributes(attributes)}
    >
      {children}
    </div>
  );
}
