import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface FieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Field({
  label,
  className,
  style,
  ...attributes
}: { label: string } & FieldAttributes) {
  return (
    <label className={className} style={style} {...scopeAttributes(attributes)}>
      {label} <input type="text" />
    </label>
  );
}
