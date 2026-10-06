import { component$ } from "@qwik.dev/core";

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

export default component$<ArticleTeaserProps>(({ title, summary, minutes = 5 }) => {
  return (
    <article class="article-teaser" aria-label={title}>
      <h2>{title}</h2>
      <p>{summary}</p>
      <p class="article-teaser-meta">{minutes} min read</p>
    </article>
  );
});
