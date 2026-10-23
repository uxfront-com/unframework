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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
