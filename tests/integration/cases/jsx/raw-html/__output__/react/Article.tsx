import type { ComponentPropsWithRef } from "react";

export interface ArticleProps {
  title: string;
  body: string;
}

export type ArticleAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "title" | "body" | "children"
>;

export default function Article({
  title,
  body,
  className,
  style,
  ...attributes
}: ArticleProps & ArticleAttributes) {
  return (
    <article className={cx("article", className)} style={style} {...attributes}>
      <h2>{title}</h2>
      <div className="body" dangerouslySetInnerHTML={{ __html: body }} />
      <footer dangerouslySetInnerHTML={{ __html: "<small>Filed under <em>News</em></small>" }} />
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
