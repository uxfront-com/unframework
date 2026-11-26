import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface TagProps {
  label: string;
  tone?: string;
}

export type TagAttributes = Omit<ComponentPropsWithRef<"em">, "label" | "tone" | "children">;

export default function Tag({
  label,
  className,
  style,
  tone: _tone,
  ...attributes
}: TagProps & TagAttributes) {
  return (
    <em
      className={cx("tag", className)}
      style={{ color: "rgb(120, 30, 30)", padding: "1px 4px", ...style }}
      {...attributes}
    >
      {label}
    </em>
  );
}
