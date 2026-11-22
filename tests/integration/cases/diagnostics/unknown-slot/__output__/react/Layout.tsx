import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface LayoutSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export interface LayoutAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Layout({
  title,
  children,
  className,
  style,
  ...attributes
}: LayoutSlots & LayoutAttributes) {
  return (
    <main className={className} style={style} {...scopeAttributes(attributes)}>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
