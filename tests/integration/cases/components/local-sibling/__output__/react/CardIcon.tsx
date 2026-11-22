import type { ComponentPropsWithRef } from "react";

export type CardIconAttributes = Omit<ComponentPropsWithRef<"span">, "symbol" | "children">;

export function CardIcon({
  symbol,
  className,
  style,
  ...attributes
}: { symbol: string } & CardIconAttributes) {
  return (
    <span className={cx("icon", className)} aria-hidden="true" style={style} {...attributes}>
      {symbol}
    </span>
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
