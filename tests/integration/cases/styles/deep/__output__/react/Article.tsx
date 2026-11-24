import Note from "./Note";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Article.uf.tsx.css";

export interface ArticleAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Article({
  title,
  note,
  className,
  style,
  ...attributes
}: { title: string; note: string } & ArticleAttributes) {
  return (
    <article
      className={cx("article", className)}
      style={style}
      data-uf-15946226=""
      {...scopeAttributes(attributes)}
    >
      <h2 className="title" data-uf-15946226="">
        {title}
      </h2>
      <Note text={note} data-uf-15946226="" />
    </article>
  );
}
