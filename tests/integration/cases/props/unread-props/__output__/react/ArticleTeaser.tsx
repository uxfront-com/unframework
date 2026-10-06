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

export default function ArticleTeaser({ title, summary, minutes = 5 }: ArticleTeaserProps) {
  return (
    <article className="article-teaser" aria-label={title}>
      <h2>{title}</h2>
      <p>{summary}</p>
      <p className="article-teaser-meta">{minutes} min read</p>
    </article>
  );
}
