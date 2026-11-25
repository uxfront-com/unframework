import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type ChipAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Chip({
  label,
  className,
  style,
  ...attributes
}: { label: string } & ChipAttributes) {
  return (
    <span className={cx("chip", className)} style={style} {...attributes}>
      {label}
    </span>
  );
}
