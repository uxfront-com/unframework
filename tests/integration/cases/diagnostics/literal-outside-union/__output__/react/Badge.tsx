import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "tone" | "children">;

export function Badge({
  tone,
  className,
  style,
  ...attributes
}: { tone: "info" | "warning" } & BadgeAttributes) {
  return (
    <span className={cx("badge", tone, className)} style={style} {...attributes}>
      {tone}
    </span>
  );
}
