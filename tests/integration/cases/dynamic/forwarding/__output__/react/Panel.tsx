import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface PanelSlots {
  title?: ReactNode;
}

export type PanelAttributes = Omit<ComponentPropsWithRef<"div">, "title" | "children">;

export default function Panel({
  title,
  className,
  style,
  ...attributes
}: PanelSlots & PanelAttributes) {
  return (
    <div className={cx("panel", className)} style={style} {...attributes}>
      <h4>{title ?? "Untitled"}</h4>
    </div>
  );
}
