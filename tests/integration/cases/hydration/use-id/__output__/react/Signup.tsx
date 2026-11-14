import Field from "./Field";
import type { CSSProperties } from "react";

export interface SignupProps {
  name: string;
  email: string;
}

export interface SignupAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Signup({
  name,
  email,
  className,
  style,
  ...attributes
}: SignupProps & SignupAttributes) {
  return (
    <form
      className={cx("signup", className)}
      aria-label="Sign up"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Field label={name} hint="As it appears on your card." />
      <Field label={email} hint="We send the receipt here." />
    </form>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
