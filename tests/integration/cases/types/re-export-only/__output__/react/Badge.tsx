import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type { Tone } from "./tone";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Badge({
  label,
  className,
  style,
  ...attributes
}: { label: string } & BadgeAttributes) {
  return (
    <span className={cx("badge", className)} style={style} {...attributes}>
      {label}
    </span>
  );
}
