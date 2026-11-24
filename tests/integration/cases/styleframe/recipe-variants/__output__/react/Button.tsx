import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

export interface ButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
    >
      {label}
    </button>
  );
}
