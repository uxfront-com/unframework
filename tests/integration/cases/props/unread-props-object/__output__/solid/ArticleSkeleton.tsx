import type { JSX } from "solid-js";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export default function ArticleSkeleton(
  props: ArticleSkeletonProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `article-skeleton ${props.class}` : "article-skeleton"}
      aria-busy="true"
      aria-label="Loading article"
      style={props.style}
    >
      <p>Loading the article</p>
    </article>
  );
}
