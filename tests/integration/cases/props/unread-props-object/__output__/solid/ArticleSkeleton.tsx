import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface ArticleSkeletonProps {
  title: string;
  summary?: string;
  minutes?: number;
}

export default function ArticleSkeleton(
  props: ArticleSkeletonProps &
    Omit<ComponentProps<"article">, "title" | "summary" | "minutes" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["title", "summary", "minutes", "class"]);

  return (
    <article
      class={props.class ? `article-skeleton ${props.class}` : "article-skeleton"}
      aria-busy="true"
      aria-label="Loading article"
      {...others}
    >
      <p>Loading the article</p>
    </article>
  );
}
