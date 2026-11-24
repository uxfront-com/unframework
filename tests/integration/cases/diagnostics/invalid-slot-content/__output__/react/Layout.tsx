import type { ComponentPropsWithRef, ReactNode } from "react";

export interface LayoutSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export type LayoutAttributes = Omit<ComponentPropsWithRef<"main">, "title" | "children">;

export function Layout({
  title,
  children,
  className,
  style,
  ...attributes
}: LayoutSlots & LayoutAttributes) {
  return (
    <main className={className} style={style} {...attributes}>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
