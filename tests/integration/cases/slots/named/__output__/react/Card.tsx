import type { CSSProperties, ReactNode } from "react";

export interface CardSlots {
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  header,
  children,
  footer,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  return (
    <article className={cx("card", className)} style={style} {...scopeAttributes(attributes)}>
      <header>{header}</header>
      <div className="body">{children}</div>
      <footer>{footer}</footer>
    </article>
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
