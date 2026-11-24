import { useMediaQuery } from "./useMediaQuery";
import type { ComponentPropsWithRef } from "react";

export type LayoutAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Layout({ className, style, ...attributes }: LayoutAttributes) {
  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section className={cx("layout", className)} aria-label="Layout" style={style} {...attributes}>
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
