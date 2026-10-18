import type { CSSProperties } from "react";

export interface FieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Field({ label, className, style }: { label: string } & FieldAttributes) {
  return (
    <label className={className} style={style}>
      {label} <input type="text" />
    </label>
  );
}
