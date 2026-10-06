export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default function CommentQuote(props: CommentQuoteProps) {
  return (
    <figure class="comment-quote">
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{props.comment}</p>
      </blockquote>
      <figcaption>{props.author}</figcaption>
    </figure>
  );
}
