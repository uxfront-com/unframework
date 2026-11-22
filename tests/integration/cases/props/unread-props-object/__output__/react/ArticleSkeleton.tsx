import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
      {...scopeAttributes(_props)}
    >
      <p>Loading the article</p>
    </article>
  );
}
