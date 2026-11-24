import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default function CommentQuote(
  props: CommentQuoteProps &
    Omit<ComponentProps<"figure">, "author" | "comment" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "author", "comment", "class");

  return (
    <figure class={props.class ? `comment-quote ${props.class}` : "comment-quote"} {...others}>
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{props.comment}</p>
      </blockquote>
      <figcaption>{props.author}</figcaption>
    </figure>
  );
}
