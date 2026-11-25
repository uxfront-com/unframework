import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "text" | "children">;

export function Badge({
  text,
  className,
  style,
  ...attributes
}: { text: string } & BadgeAttributes) {
  return (
    <span className={cx("badge", className)} style={style} {...attributes}>
      {text}
    </span>
  );
}
