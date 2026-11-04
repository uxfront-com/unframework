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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
