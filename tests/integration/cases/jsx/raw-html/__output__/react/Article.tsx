import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface ArticleProps {
  title: string;
  body: string;
}

export type ArticleAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "title" | "body" | "children"
>;

export default function Article({
  title,
  body,
  className,
  style,
  ...attributes
}: ArticleProps & ArticleAttributes) {
  return (
    <article className={cx("article", className)} style={style} {...attributes}>
      <h2>{title}</h2>
      <div className="body" dangerouslySetInnerHTML={{ __html: body }} />
      <footer dangerouslySetInnerHTML={{ __html: "<small>Filed under <em>News</em></small>" }} />
    </article>
  );
}
