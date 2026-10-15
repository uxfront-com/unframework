import type { JSX } from "solid-js";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default function CommentQuote(
  props: CommentQuoteProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <figure
      class={props.class ? `comment-quote ${props.class}` : "comment-quote"}
      style={props.style}
    >
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{props.comment}</p>
      </blockquote>
      <figcaption>{props.author}</figcaption>
    </figure>
  );
}
