import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type TagAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Tag({
  label,
  className,
  style,
  ...attributes
}: { label: string } & TagAttributes) {
  return (
    <span
      className={cx("tag", className)}
      style={{ padding: "2px 6px", color: "rgb(30, 30, 30)", ...style }}
      {...attributes}
    >
      {label}
    </span>
  );
}
