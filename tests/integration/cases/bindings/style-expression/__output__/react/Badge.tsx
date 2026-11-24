import { cx } from "./_unframework/cx";
import { styleObject } from "./_unframework/styleObject";
import type { ComponentPropsWithRef } from "react";

export interface BadgeProps {
  label: string;
  tone?: string;
}

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "tone" | "children">;

export default function Badge({
  label,
  tone,
  className,
  style,
  ...attributes
}: BadgeProps & BadgeAttributes) {
  return (
    <span
      className={cx("badge", className)}
      style={{ ...styleObject(tone), ...style }}
      {...attributes}
    >
      {label}
    </span>
  );
}
