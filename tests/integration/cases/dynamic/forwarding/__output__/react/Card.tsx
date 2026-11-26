import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface CardSlots {
  title?: ReactNode;
}

export type CardAttributes = Omit<ComponentPropsWithRef<"div">, "title" | "children">;

export default function Card({
  title,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  return (
    <div className={cx("card", className)} style={style} {...attributes}>
      <h3>{title ?? "Untitled"}</h3>
    </div>
  );
}
