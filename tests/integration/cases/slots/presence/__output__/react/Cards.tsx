import Card from "./Card";
import type { CSSProperties } from "react";

export interface CardsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Cards({ className, style, ...attributes }: CardsAttributes) {
  return (
    <div className={cx("cards", className)} style={style} {...scopeAttributes(attributes)}>
      <Card label="Full" title={<h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
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
