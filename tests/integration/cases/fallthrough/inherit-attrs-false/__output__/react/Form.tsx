import Field from "./Field";
import type { CSSProperties } from "react";

export interface FormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Form({ className, style, ...attributes }: FormAttributes) {
  return (
    <form aria-label="Sign up" className={className} style={style} {...scopeAttributes(attributes)}>
      <Field label="Email" />
      <Field label="Name" />
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
