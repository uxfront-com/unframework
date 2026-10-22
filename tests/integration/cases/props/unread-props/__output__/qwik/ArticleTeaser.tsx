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
  ({ title, summary, minutes = 5, class: className, style, ...attributes }) => {
    return (
      <article
        class={["article-teaser", className]}
        aria-label={title}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2>{title}</h2>
        <p>{summary}</p>
        <p class="article-teaser-meta">{minutes} min read</p>
      </article>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
