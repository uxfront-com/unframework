import { Show } from "solid-js";

export interface ArticleHeaderProps {
  title: string;
  subtitle?: string;
  draft: boolean;
  tags: string[];
}

export default function ArticleHeader(props: ArticleHeaderProps) {
  return (
    <>
      <h2>{props.title}</h2>
      <Show when={props.subtitle}>
        <p class="article-subtitle">{props.subtitle}</p>
      </Show>
      <Show
        when={props.draft}
        fallback={
          <>
            <p class="article-badge">Published</p>
            <p>Everyone can read this article.</p>
          </>
        }
      >
        <p class="article-badge">Draft</p>
        <p>Only editors can see this article.</p>
      </Show>
      <p>Tagged {props.tags.join(", ")}</p>
    </>
  );
}
