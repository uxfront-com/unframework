export interface ArticleHeaderProps {
  title: string;
  subtitle?: string;
  draft: boolean;
  tags: string[];
}

export default function ArticleHeader({ title, subtitle, draft, tags }: ArticleHeaderProps) {
  return (
    <>
      <h2>{title}</h2>
      {subtitle && <p class="article-subtitle">{subtitle}</p>}
      {draft ? (
        <>
          <p class="article-badge">Draft</p>
          <p>Only editors can see this article.</p>
        </>
      ) : (
        <>
          <p class="article-badge">Published</p>
          <p>Everyone can read this article.</p>
        </>
      )}
      <p>
        Tagged <>{tags.join(", ")}</>
      </p>
    </>
  );
}
