import type { FieldOptions } from "./types";
import type { CSSProperties } from "react";

export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
  Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;

export interface TextFieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function TextField({
  name,
  label,
  placeholder,
  required,
  className,
  style,
  ...attributes
}: TextFieldProps & TextFieldAttributes) {
  return (
    <label className={className} style={style} {...scopeAttributes(attributes)}>
      {label}
      <input name={name} placeholder={placeholder} required={required} />
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
