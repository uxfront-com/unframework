import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

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

export default function ArticleTeaser(
  rawProps: ArticleTeaserProps &
    Omit<
      ComponentProps<"article">,
      | "title"
      | "summary"
      | "author"
      | "minutes"
      | "featured"
      | "category"
      | "pinned"
      | "layout"
      | "class"
      | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get minutes() {
      return rawProps.minutes === undefined ? 5 : rawProps.minutes;
    },
  });
  const others = omit(
    props,
    "title",
    "summary",
    "author",
    "minutes",
    "featured",
    "category",
    "pinned",
    "layout",
    "class",
  );

  return (
    <article
      class={props.class ? `article-teaser ${props.class}` : "article-teaser"}
      aria-label={props.title}
      {...others}
    >
      <h2>{props.title}</h2>
      <p>{props.summary}</p>
      <p class="article-teaser-meta">{props.minutes} min read</p>
    </article>
  );
}
