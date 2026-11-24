import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface FieldProps {
  name: string;
  label: string;
}

export interface FieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Field({
  name,
  label,
  className,
  style,
  ...attributes
}: FieldProps & FieldAttributes) {
  return (
    <label className={className} style={style} {...scopeAttributes(attributes)}>
      {label}
      <input name={name} />
    </label>
  );
}
