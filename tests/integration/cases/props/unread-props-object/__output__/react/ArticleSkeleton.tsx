import type { ComponentPropsWithRef } from "react";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export type ArticleSkeletonAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "title" | "summary" | "minutes" | "children"
>;

export default function ArticleSkeleton(_props: ArticleSkeletonProps & ArticleSkeletonAttributes) {
  const {
    className,
    style,
    title: _title,
    summary: _summary,
    minutes: _minutes,
    ...attributes
  } = _props;

  return (
    <article
      className={cx("article-skeleton", className)}
      aria-busy="true"
      aria-label="Loading article"
      style={style}
      {...attributes}
    >
      <p>Loading the article</p>
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
