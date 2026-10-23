import Note from "./Note";
import type { CSSProperties } from "react";
import "./Article.uf.tsx.css";

export interface ArticleAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Article({
  title,
  note,
  className,
  style,
  ...attributes
}: { title: string; note: string } & ArticleAttributes) {
  return (
    <article
      className={cx("article", className)}
      style={style}
      data-uf-15946226=""
      {...scopeAttributes(attributes)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
