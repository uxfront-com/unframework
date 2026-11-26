import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export type CommentQuoteAttributes = Omit<
  ComponentPropsWithRef<"figure">,
  "author" | "comment" | "children"
>;

export default function CommentQuote({
  author,
  comment,
  className,
  style,
  ...attributes
}: CommentQuoteProps & CommentQuoteAttributes) {
  return (
    <figure className={cx("comment-quote", className)} style={style} {...attributes}>
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{comment}</p>
      </blockquote>
      <figcaption>{author}</figcaption>
    </figure>
  );
}
