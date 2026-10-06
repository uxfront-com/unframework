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

export default function ArticleTeaser({
  title,
  summary,
  minutes = 5,
  // The teaser takes the article card's props and shows only some: these two keep the card's
  // defaults, which nothing here reads.
  // oxlint-disable-next-line no-unused-vars
  pinned = false,
  // oxlint-disable-next-line no-unused-vars
  layout = "row",
}: ArticleTeaserProps) {
  return (
    <article class="article-teaser" aria-label={title}>
      <h2>{title}</h2>
      <p>{summary}</p>
      <p class="article-teaser-meta">{minutes} min read</p>
    </article>
  );
}
