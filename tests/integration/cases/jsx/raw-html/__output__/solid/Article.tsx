import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface ArticleProps {
  title: string;
  body: string;
}

export default function Article(
  props: ArticleProps &
    Omit<ComponentProps<"article">, "title" | "body" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "body", "class"]);

  return (
    <article class={props.class ? `article ${props.class}` : "article"} {...others}>
      <h2>{props.title}</h2>
      <div class="body" innerHTML={props.body} />
      <footer innerHTML={"<small>Filed under <em>News</em></small>"} />
    </article>
  );
}
