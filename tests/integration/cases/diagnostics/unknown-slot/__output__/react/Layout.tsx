import type { CSSProperties, ReactNode } from "react";

export interface LayoutSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export interface LayoutAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Layout({ title, children, className, style }: LayoutSlots & LayoutAttributes) {
  return (
    <main className={className} style={style}>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
