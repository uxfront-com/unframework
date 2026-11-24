import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ArticleProps {
  title: string;
  body: string;
}

export default function Article(
  props: ArticleProps &
    Omit<ComponentProps<"article">, "title" | "body" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "body", "class");

  return (
    <article class={props.class ? `article ${props.class}` : "article"} {...others}>
      <h2>{props.title}</h2>
      <div class="body" innerHTML={props.body} />
      <footer innerHTML={"<small>Filed under <em>News</em></small>"} />
    </article>
  );
}
