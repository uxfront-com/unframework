import type { CSSProperties } from "react";

export type ButtonTone = "primary" | "secondary";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

export interface ButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Button({
  label,
  tone = "primary",
  className,
  style,
  ...attributes
}: ButtonProps & ButtonAttributes) {
  return (
    <button
      type="button"
      className={cx(`button button-${tone}`, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {label}
    </button>
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
