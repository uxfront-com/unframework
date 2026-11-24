import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear?: (label: string) => void;
}

export interface FieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Field({
  label,
  tone = "info",
  onClear,
  className,
  style,
  ...attributes
}: FieldProps & FieldEvents & FieldAttributes) {
  return (
    <div className={cx("field", tone, className)} style={style} {...scopeAttributes(attributes)}>
      <span>{label}</span>
      <button type="button" onClick={() => onClear?.(label)}>
        Clear {label}
      </button>
    </div>
  );
}
