import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ArticleProps {
  title: string;
  body: string;
}

export interface ArticleAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Article({
  title,
  body,
  className,
  style,
  ...attributes
}: ArticleProps & ArticleAttributes) {
  return (
    <article className={cx("article", className)} style={style} {...scopeAttributes(attributes)}>
      <h2>{title}</h2>
      <div className="body" dangerouslySetInnerHTML={{ __html: body }} />
      <footer dangerouslySetInnerHTML={{ __html: "<small>Filed under <em>News</em></small>" }} />
    </article>
  );
}
