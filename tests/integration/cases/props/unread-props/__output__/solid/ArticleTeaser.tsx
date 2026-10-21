import { type JSX, mergeProps } from "solid-js";

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
  rawProps: ArticleTeaserProps & { class?: string; style?: JSX.CSSProperties },
) {
  const props = mergeProps({ minutes: 5 } satisfies Partial<ArticleTeaserProps>, rawProps);
  return (
    <article
      class={props.class ? `article-teaser ${props.class}` : "article-teaser"}
      aria-label={props.title}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.title}</h2>
      <p>{props.summary}</p>
      <p class="article-teaser-meta">{props.minutes} min read</p>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
