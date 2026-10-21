import { ThemeKey } from "./ThemeProvider";
import { type CSSProperties, use } from "react";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  text,
  className,
  style,
  ...attributes
}: { text: string } & BadgeAttributes) {
  const theme = use(ThemeKey);

  return (
    <span
      className={cx("badge", theme?.accent, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {text} in {theme?.label ?? "no theme"}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
