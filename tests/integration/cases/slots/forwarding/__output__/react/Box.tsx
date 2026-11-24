import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface BoxSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export type BoxAttributes = Omit<ComponentPropsWithRef<"div">, "title" | "children">;

export default function Box({
  title,
  children,
  className,
  style,
  ...attributes
}: BoxSlots & BoxAttributes) {
  return (
    <div className={cx("box", className)} style={style} {...attributes}>
      <h3>{title ?? "Untitled"}</h3>
      {children ?? <p>No content</p>}
    </div>
  );
}
