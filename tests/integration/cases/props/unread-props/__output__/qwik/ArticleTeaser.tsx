import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

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

export default component$<ArticleTeaserProps & { class?: ClassList; style?: CSSProperties }>(
  ({ title, summary, minutes = 5, class: className, style }) => {
    return (
      <article class={["article-teaser", className]} aria-label={title} style={style}>
        <h2>{title}</h2>
        <p>{summary}</p>
        <p class="article-teaser-meta">{minutes} min read</p>
      </article>
    );
  },
);
