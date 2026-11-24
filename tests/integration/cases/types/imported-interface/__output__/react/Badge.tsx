import { cx } from "./_unframework/cx";
import type { BadgeProps } from "./types";
import type { ComponentPropsWithRef } from "react";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "tone" | "children">;

export default function Badge({
  label,
  tone = "info",
  className,
  style,
  ...attributes
}: BadgeProps & BadgeAttributes) {
  return (
    <span className={cx(`badge badge-${tone}`, className)} style={style} {...attributes}>
      {label}
    </span>
  );
}
