import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default component$<CommentQuoteProps & { class?: ClassList; style?: CSSProperties }>(
  ({ author, comment, class: className, style }) => {
    return (
      <figure class={["comment-quote", className]} style={style}>
        <blockquote style={{ margin: "0", padding: "0" }}>
          <p dir="auto">{comment}</p>
        </blockquote>
        <figcaption>{author}</figcaption>
      </figure>
    );
  },
);
