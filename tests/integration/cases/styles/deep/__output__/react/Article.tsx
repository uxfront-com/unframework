import Note from "./Note";
import type { ComponentPropsWithRef } from "react";
import "./Article.uf.tsx.css";

export type ArticleAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "title" | "note" | "children"
>;

export default function Article({
  title,
  note,
  className,
  style,
  ...attributes
}: { title: string; note: string } & ArticleAttributes) {
  return (
    <article className={cx("article", className)} style={style} data-uf-15946226="" {...attributes}>
      <h2 className="title" data-uf-15946226="">
        {title}
      </h2>
      <Note text={note} data-uf-15946226="" />
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
