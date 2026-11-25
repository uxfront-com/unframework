import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface PanelSlots {
  children?: ReactNode;
}

export type PanelAttributes = Omit<ComponentPropsWithRef<"section">, "title" | "children">;

export default function Panel({
  title,
  children,
  className,
  style,
  ...attributes
}: { title: string } & PanelSlots & PanelAttributes) {
  return (
    <section className={cx("panel", className)} aria-label={title} style={style} {...attributes}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
