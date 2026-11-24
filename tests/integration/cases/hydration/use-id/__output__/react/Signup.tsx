import Field from "./Field";
import type { ComponentPropsWithRef } from "react";

export interface SignupProps {
  name: string;
  email: string;
}

export type SignupAttributes = Omit<ComponentPropsWithRef<"form">, "name" | "email" | "children">;

export default function Signup({
  name,
  email,
  className,
  style,
  ...attributes
}: SignupProps & SignupAttributes) {
  return (
    <form className={cx("signup", className)} aria-label="Sign up" style={style} {...attributes}>
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
