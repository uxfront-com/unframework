import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: ArticleTeaserProps & ArticleTeaserAttributes) {
  return (
    <article
      className={cx("article-teaser", className)}
      aria-label={title}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{title}</h2>
      <p>{summary}</p>
      <p className="article-teaser-meta">{minutes} min read</p>
    </article>
  );
}
