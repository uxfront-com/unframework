import type { CSSProperties } from "react";

export interface PillAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Pill({ text, className, style, ...attributes }: { text: string } & PillAttributes) {
  return (
    <span className={cx_1("pill", className)} style={style} {...scopeAttributes_1(attributes)}>
      {text}
    </span>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx_1(...parts: unknown[]): string {
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
function scopeAttributes_1(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
