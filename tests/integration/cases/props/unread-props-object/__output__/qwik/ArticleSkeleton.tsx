import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export default component$<ArticleSkeletonProps & { class?: ClassList; style?: CSSProperties }>(
  (_props) => {
    return (
      <article
        class={["article-skeleton", _props.class]}
        aria-busy="true"
        aria-label="Loading article"
        {...scopeAttributes(_props)}
        style={_props.style}
      >
        <p>Loading the article</p>
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
