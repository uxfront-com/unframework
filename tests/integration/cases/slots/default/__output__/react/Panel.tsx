import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface PanelSlots {
  children?: ReactNode;
}

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({
  title,
  children,
  className,
  style,
  ...attributes
}: { title: string } & PanelSlots & PanelAttributes) {
  return (
    <section
      className={cx("panel", className)}
      aria-label={title}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{title}</h2>
      {children}
    </section>
  );
}
