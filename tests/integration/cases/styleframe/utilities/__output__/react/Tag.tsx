import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "virtual:styleframe.css";

export type TagAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "children">;

export default function Tag({
  label,
  className,
  style,
  ...attributes
}: { label: string } & TagAttributes) {
  return (
    <span
      className={cx(
        "_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]",
        className,
      )}
      style={style}
      {...attributes}
    >
      {label}
    </span>
  );
}
