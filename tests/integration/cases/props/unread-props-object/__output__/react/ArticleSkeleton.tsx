import type { CSSProperties } from "react";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export interface ArticleSkeletonAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ArticleSkeleton(_props: ArticleSkeletonProps & ArticleSkeletonAttributes) {
  return (
    <article
      className={cx("article-skeleton", _props.className)}
      aria-busy="true"
      aria-label="Loading article"
      style={_props.style}
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
