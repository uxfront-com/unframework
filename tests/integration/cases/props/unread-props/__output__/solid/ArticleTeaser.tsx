import { mergeProps } from "solid-js";

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

export default function ArticleTeaser(rawProps: ArticleTeaserProps) {
  const props = mergeProps({ minutes: 5 } satisfies Partial<ArticleTeaserProps>, rawProps);
  return (
    <article class="article-teaser" aria-label={props.title}>
      <h2>{props.title}</h2>
      <p>{props.summary}</p>
      <p class="article-teaser-meta">{props.minutes} min read</p>
    </article>
  );
}
