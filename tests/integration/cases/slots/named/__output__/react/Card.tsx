import type { ComponentPropsWithRef, ReactNode } from "react";

export interface CardSlots {
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export type CardAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "header" | "children" | "footer"
>;

export default function Card({
  header,
  children,
  footer,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  return (
    <article className={cx("card", className)} style={style} {...attributes}>
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
