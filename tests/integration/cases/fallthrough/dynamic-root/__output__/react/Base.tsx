import type { CSSProperties, MouseEvent } from "react";

export interface BaseEvents {
  onPress?: () => void;
}

export interface BaseAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Base({
  href,
  disabled,
  text,
  onPress,
  className,
  style,
  ...attributes
}: { href?: string; disabled?: boolean; text: string } & BaseEvents & BaseAttributes) {
  function press(event: MouseEvent) {
    event.preventDefault();
    onPress?.();
  }

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={Tag === "a" ? href : undefined}
      disabled={Tag === "button" ? disabled : undefined}
      className={cx("base", className)}
      style={{ padding: "4px 8px", ...style }}
      onClick={press}
      {...scopeAttributes(attributes)}
    >
      {text}
    </Tag>
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
