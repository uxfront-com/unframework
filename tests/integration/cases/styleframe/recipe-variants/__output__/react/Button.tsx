import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

export type ButtonAttributes = Omit<
  ComponentPropsWithRef<"button">,
  "label" | "size" | "tone" | "children"
>;

export default function Button({
  label,
  size,
  tone,
  className,
  style,
  ...attributes
}: { label: string; size?: "sm" | "lg"; tone?: "neutral" | "primary" } & ButtonAttributes) {
  return (
    <button
      type="button"
      className={cx(button({ size, tone }), className)}
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
}
