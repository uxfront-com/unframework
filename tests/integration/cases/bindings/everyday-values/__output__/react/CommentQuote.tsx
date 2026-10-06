export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default function CommentQuote({ author, comment }: CommentQuoteProps) {
  return (
    <figure className="comment-quote">
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{comment}</p>
      </blockquote>
      <figcaption>{author}</figcaption>
    </figure>
  );
}
