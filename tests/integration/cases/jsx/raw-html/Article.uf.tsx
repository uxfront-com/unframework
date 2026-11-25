export interface ArticleProps {
  title: string;
  body: string;
}

export default function Article({ title, body }: ArticleProps) {
  return (
    <article class="article">
      <h2>{title}</h2>
      <div class="body" innerHTML={body} />
      <footer innerHTML="<small>Filed under <em>News</em></small>" />
    </article>
  );
}
