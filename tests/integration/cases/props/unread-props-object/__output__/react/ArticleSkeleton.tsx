export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export default function ArticleSkeleton(_props: ArticleSkeletonProps) {
  return (
    <article className="article-skeleton" aria-busy="true" aria-label="Loading article">
      <p>Loading the article</p>
    </article>
  );
}
