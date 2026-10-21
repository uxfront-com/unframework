import { CardIcon } from "./CardIcon";
import type { CSSProperties } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <div className={cx_1("card", className)} style={style} {...scopeAttributes_1(attributes)}>
      <CardIcon symbol="+" />
      <h3>{title}</h3>
      <CardIcon symbol="-" />
    </div>
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
