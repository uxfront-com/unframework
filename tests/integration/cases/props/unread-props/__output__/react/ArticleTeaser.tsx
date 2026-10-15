import type { CSSProperties } from "react";

export interface ArticleTeaserProps {
  title: string;
  summary: string;
  author: string;
  minutes?: number;
  featured?: boolean;
  category?: string;
  pinned?: boolean;
  layout?: "row" | "column";
}

export interface ArticleTeaserAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ArticleTeaser({
  title,
  summary,
  minutes = 5,
  className,
  style,
}: ArticleTeaserProps & ArticleTeaserAttributes) {
  return (
    <article className={cx("article-teaser", className)} aria-label={title} style={style}>
      <h2>{title}</h2>
      <p>{summary}</p>
      <p className="article-teaser-meta">{minutes} min read</p>
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
