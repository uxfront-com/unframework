import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export interface CommentQuoteAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function CommentQuote({
  author,
  comment,
  className,
  style,
  ...attributes
}: CommentQuoteProps & CommentQuoteAttributes) {
  return (
    <figure
      className={cx("comment-quote", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{comment}</p>
      </blockquote>
      <figcaption>{author}</figcaption>
    </figure>
  );
}
