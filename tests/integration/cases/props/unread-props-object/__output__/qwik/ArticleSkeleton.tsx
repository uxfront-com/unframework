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
        style={_props.style}
      >
        <p>Loading the article</p>
      </article>
    );
  },
);
