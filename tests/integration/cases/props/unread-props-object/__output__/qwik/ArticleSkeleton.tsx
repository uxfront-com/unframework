import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export default component$<
  ArticleSkeletonProps &
    Omit<PropsOf<"article">, "title" | "summary" | "minutes" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>((_props) => {
  const {
    title: _title,
    summary: _summary,
    minutes: _minutes,
    class: _class,
    style: _style,
    ...attributes
  } = _props;

  return (
    <article
      class={["article-skeleton", _props.class]}
      aria-busy="true"
      aria-label="Loading article"
      style={_props.style}
      {...attributes}
    >
      <p>Loading the article</p>
    </article>
  );
});
