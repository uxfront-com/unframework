import { component$ } from "@qwik.dev/core";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export default component$<ArticleSkeletonProps>(() => {
  return (
    <article class="article-skeleton" aria-busy="true" aria-label="Loading article">
      <p>Loading the article</p>
    </article>
  );
});
