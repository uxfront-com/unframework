import { cx } from "./_unframework/cx";
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
