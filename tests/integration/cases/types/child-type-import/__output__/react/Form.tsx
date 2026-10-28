import Field from "./Field";
import type { CSSProperties } from "react";

export interface FormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Form({
  field,
  className,
  style,
  ...attributes
}: { field: FieldProps } & FormAttributes) {
  return (
    <form aria-label="Sign up" className={className} style={style} {...scopeAttributes(attributes)}>
      <Field name={field.name} label={field.label} />
    </form>
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
