import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface PanelSlots {
  title?: ReactNode;
}

export interface PanelAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Panel({
  title,
  className,
  style,
  ...attributes
}: PanelSlots & PanelAttributes) {
  return (
    <div className={cx("panel", className)} style={style} {...scopeAttributes(attributes)}>
      <h4>{title ?? "Untitled"}</h4>
    </div>
  );
}
