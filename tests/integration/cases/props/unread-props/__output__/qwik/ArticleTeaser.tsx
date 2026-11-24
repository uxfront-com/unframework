import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

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

export default component$<
  ArticleTeaserProps &
    Omit<
      PropsOf<"article">,
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
    > & { class?: ClassList; style?: CSSProperties }
>(
  ({
    title,
    summary,
    minutes = 5,
    class: className,
    style,
    author: _author,
    featured: _featured,
    category: _category,
    pinned: _pinned,
    layout: _layout,
    ...attributes
  }) => {
    return (
      <article
        class={["article-teaser", className]}
        aria-label={title}
        style={style}
        {...attributes}
      >
        <h2>{title}</h2>
        <p>{summary}</p>
        <p class="article-teaser-meta">{minutes} min read</p>
      </article>
    );
  },
);
