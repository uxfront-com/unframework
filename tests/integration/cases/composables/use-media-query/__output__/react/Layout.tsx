import { useMediaQuery } from "./useMediaQuery";
import type { CSSProperties } from "react";

export interface LayoutAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Layout({ className, style, ...attributes }: LayoutAttributes) {
  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section
      className={cx("layout", className)}
      aria-label="Layout"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p role="status">{wide ? "Wide layout" : "Narrow layout"}</p>
      <p>{tiny ? "Tiny screen" : "Not a tiny screen"}</p>
    </section>
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
