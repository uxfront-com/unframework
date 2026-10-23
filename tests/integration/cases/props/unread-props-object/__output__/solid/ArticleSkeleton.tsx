import type { JSX } from "solid-js";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export default function ArticleSkeleton(
  props: ArticleSkeletonProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `article-skeleton ${props.class}` : "article-skeleton"}
      aria-busy="true"
      aria-label="Loading article"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p>Loading the article</p>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
