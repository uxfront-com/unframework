import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Badge({
  label,
  className,
  style,
  ...attributes
}: { label: string } & BadgeAttributes) {
  return (
    <span className={cx(badge(), className)} style={style} {...attributes}>
      {label}
    </span>
  );
}
