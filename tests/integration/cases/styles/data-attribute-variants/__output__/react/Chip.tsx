import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Chip.uf.tsx.css";

export interface ChipAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Chip({
  label,
  variant = "neutral",
  pressed = false,
  className,
  style,
  ...attributes
}: { label: string; variant?: "neutral" | "danger"; pressed?: boolean } & ChipAttributes) {
  return (
    <button
      type="button"
      className={cx("chip", className)}
      data-variant={variant}
      data-state={pressed ? "on" : "off"}
      aria-pressed={pressed ? "true" : "false"}
      style={style}
      data-uf-69db3802=""
      {...scopeAttributes(attributes)}
    >
      {label}
    </button>
  );
}
