import { component$ } from "@qwik.dev/core";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default component$<CommentQuoteProps>(({ author, comment }) => {
  return (
    <figure class="comment-quote">
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{comment}</p>
      </blockquote>
      <figcaption>{author}</figcaption>
    </figure>
  );
});
